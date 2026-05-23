"""HTTP client for TrainerRoad's internal API.

Supports two auth methods:
1. Username/password (preferred) — performs a programmatic login to get a session cookie
2. Direct cookie — uses a manually-provided SharedTrainerRoadAuth cookie
"""

import json
import logging
from typing import Any

import httpx

from intervals_mcp_server.trainerroad.models import (
    TRCalendarActivity,
    TRMemberInfo,
    TRWorkoutDetails,
)

logger = logging.getLogger("intervals_icu_mcp_server.trainerroad")

TR_BASE_URL = "https://www.trainerroad.com"
TR_API_URL = "https://api.trainerroad.com"


class TRAuthError(Exception):
    """Raised when TR authentication fails."""


class TRClient:
    """Async HTTP client for TrainerRoad's API.

    Auth priority: username/password login (auto-acquires cookie) > direct cookie.
    The session cookie is cached for the client's lifetime (~1 year expiry).
    """

    def __init__(
        self,
        username: str | None = None,
        password: str | None = None,
        cookie: str | None = None,
        member_id: int | None = None,
    ) -> None:
        self._username_cred = username
        self._password = password
        self._cookie: str | None = cookie
        self._cached_member_id = member_id
        self._tr_username: str | None = None
        self._member: TRMemberInfo | None = None

    async def _login(self) -> str:
        """Log in with username/password and return the SharedTrainerRoadAuth cookie."""
        if not self._username_cred or not self._password:
            raise TRAuthError("TR username and password are required for login.")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{TR_BASE_URL}/app/login",
                data={
                    "Username": self._username_cred,
                    "Password": self._password,
                },
                follow_redirects=False,
                timeout=30.0,
            )

        if resp.status_code not in (301, 302):
            raise TRAuthError(f"TR login failed (status {resp.status_code}).")

        location = resp.headers.get("location", "")
        if "/career/" in location:
            self._tr_username = location.split("/career/")[1].split("?")[0]

        for cookie_header in resp.headers.get_list("set-cookie"):
            if "SharedTrainerRoadAuth=" in cookie_header:
                value = cookie_header.split("SharedTrainerRoadAuth=")[1].split(";")[0]
                return f"SharedTrainerRoadAuth={value}"

        raise TRAuthError("TR login succeeded but no auth cookie was returned.")

    async def _ensure_cookie(self) -> None:
        """Ensure we have a valid session cookie, logging in if needed."""
        if self._cookie:
            return
        if self._username_cred and self._password:
            self._cookie = await self._login()
            return
        raise TRAuthError("No TR credentials configured.")

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "intervalsicu-mcp-server/1.0",
        }
        if self._cookie:
            headers["Cookie"] = self._cookie
        return headers

    async def _get(self, path: str, params: dict[str, str] | None = None) -> Any:
        await self._ensure_cookie()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TR_BASE_URL}{path}",
                headers=self._headers(),
                params=params,
                timeout=30.0,
            )
            if resp.status_code in (401, 403) and self._username_cred and self._password:
                self._cookie = await self._login()
                resp = await client.get(
                    f"{TR_BASE_URL}{path}",
                    headers=self._headers(),
                    params=params,
                    timeout=30.0,
                )
            resp.raise_for_status()
            return resp.json()

    async def _get_basic_auth(self, path: str) -> Any:
        """Make a request to api.trainerroad.com using Basic Auth."""
        if not self._username_cred or not self._password:
            raise TRAuthError("TR username and password required for Basic Auth.")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TR_API_URL}{path}",
                auth=httpx.BasicAuth(self._username_cred, self._password),
                headers={"Accept": "application/json"},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def _search_workouts(
        self, search_text: str, page_size: int = 10
    ) -> list[dict]:
        """Search the TR workout library by name."""
        await self._ensure_cookie()
        payload = json.dumps({
            "searchText": search_text,
            "pageNumber": 0,
            "pageSize": page_size,
        })
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{TR_BASE_URL}/app/api/workouts",
                headers={**self._headers(), "Content-Type": "application/json"},
                content=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("Workouts", [])

    async def validate_and_get_member(self) -> TRMemberInfo:
        """Validate auth and return member info.

        Uses cached member_id from config to skip the validation roundtrip when
        the username is also known (from the login redirect). Otherwise tries
        Basic Auth first, then falls back to cookie-based member-info.
        """
        if self._member:
            return self._member

        if self._cached_member_id:
            await self._ensure_cookie()
            tr_username = self._tr_username
            if not tr_username:
                data = await self._get("/app/api/member-info")
                if data:
                    tr_username = data.get("Username", "")
            if tr_username:
                member = TRMemberInfo(
                    member_id=self._cached_member_id,
                    username=tr_username,
                )
                self._member = member
                return member

        if self._username_cred and self._password:
            try:
                data = await self._get_basic_auth("/api/members")
                member = TRMemberInfo.from_api(data)
                if member.is_valid:
                    self._member = member
                    return member
            except httpx.HTTPStatusError:
                pass

        data = await self._get("/app/api/member-info")
        if data is None:
            raise TRAuthError("TR returned null for member-info — auth is invalid or expired.")
        member = TRMemberInfo.from_api(data)
        if not member.is_valid:
            raise TRAuthError("TR auth is invalid or expired (MemberId=-1).")
        self._member = member
        return member

    async def get_member(self) -> TRMemberInfo:
        """Get member info, validating auth if needed."""
        if self._member is None:
            await self.validate_and_get_member()
        assert self._member is not None
        return self._member

    async def get_calendar_activities(
        self, start_date: str, end_date: str
    ) -> list[TRCalendarActivity]:
        """Fetch calendar activities (planned + completed) for a date range."""
        member = await self.get_member()
        data = await self._get(
            f"/app/api/calendar/activities/{member.username}",
            params={"startDate": start_date, "endDate": end_date},
        )
        if not isinstance(data, list):
            return []
        return [TRCalendarActivity.from_api(item) for item in data if isinstance(item, dict)]

    async def get_training_plan(self) -> dict:
        """Fetch current training plan info (phase, week, volume).

        Tries multiple TR API endpoints since the internal API structure varies.
        Returns raw dict with whatever plan metadata is available.
        """
        member = await self.get_member()
        # Try the training-plan endpoint first
        for path in (
            f"/app/api/training-plan/{member.username}",
            f"/app/api/calendar/training-plan/{member.username}",
            f"/app/api/training-plans/{member.member_id}",
        ):
            try:
                data = await self._get(path)
                if isinstance(data, dict) and data:
                    return data
                if isinstance(data, list) and data:
                    return data[0] if isinstance(data[0], dict) else {}
            except httpx.HTTPStatusError:
                continue
        return {}

    async def get_workout_details(self, workout_id: str) -> TRWorkoutDetails:
        """Fetch full workout details including interval structure."""
        data = await self._get(f"/app/api/workoutdetails/{workout_id}")
        return TRWorkoutDetails.from_api(data)

    async def find_workout_by_name(self, name: str) -> TRWorkoutDetails | None:
        """Search for a workout by exact name and return its details."""
        workouts = await self._search_workouts(name, page_size=20)
        for w in workouts:
            if w.get("WorkoutName", "").lower() == name.lower():
                workout_id = str(w["Id"])
                return await self.get_workout_details(workout_id)
        return None
