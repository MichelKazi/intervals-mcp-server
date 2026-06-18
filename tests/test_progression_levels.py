"""Tests for progression level tools and formatting helpers."""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture
def mock_levels_response():
    return {
        "zones": {
            "endurance": {"level": 4.1, "delta": 0.2, "confidence": "high", "reasoning": "Based on 6 sessions...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "tempo": {"level": 3.2, "delta": -0.1, "confidence": "medium", "reasoning": "Based on 3 sessions...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "sweet_spot": {"level": 4.1, "delta": 0.0, "confidence": "high", "reasoning": "Stable...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "threshold": {"level": 3.3, "delta": 0.1, "confidence": "high", "reasoning": "Threshold improving...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "vo2max": {"level": 5.3, "delta": 0.3, "confidence": "high", "reasoning": "VO2max leading...", "asymmetry_note": "vo2max (5.3) is a relative strength (+1.5 vs median 4.0)", "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "anaerobic": {"level": 4.0, "delta": 0.0, "confidence": "medium", "reasoning": "Stable...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
            "sprint": {"level": 2.5, "delta": 0.0, "confidence": "low", "reasoning": "Limited sprint data...", "asymmetry_note": None, "computed_at": "2026-06-18T10:00:00", "is_correction": False},
        },
        "ftp": 282,
    }


@pytest.mark.asyncio
@patch("intervals_mcp_server.directeur_client.get_levels")
async def test_get_progression_levels_all_zones(mock_get, mock_levels_response):
    mock_get.return_value = mock_levels_response

    from intervals_mcp_server.tools.progression_levels import _format_levels_output
    output = _format_levels_output(mock_levels_response)

    assert "vo2max" in output.lower()
    assert "5.3" in output
    assert "relative strength" in output
    assert "282W" in output or "282" in output


@pytest.mark.asyncio
@patch("intervals_mcp_server.directeur_client.post_level_correction")
async def test_correct_progression_level(mock_post):
    mock_post.return_value = {
        "zone": "threshold",
        "original_computed_level": 3.3,
        "corrected_to": 4.5,
        "rationale": "Wednesday's session felt easy",
        "expires_at": "2026-07-02T10:00:00",
        "blend_behavior": "Future computations will blend 70% computed / 30% this correction until expiry.",
    }

    from intervals_mcp_server.tools.progression_levels import _format_correction_output
    output = _format_correction_output(mock_post.return_value)

    assert "3.3" in output
    assert "4.5" in output
    assert "Wednesday" in output


def test_format_levels_output_low_confidence_flag(mock_levels_response):
    from intervals_mcp_server.tools.progression_levels import _format_levels_output
    output = _format_levels_output(mock_levels_response)
    assert "LOW CONFIDENCE" in output


def test_format_levels_output_asymmetry_section(mock_levels_response):
    from intervals_mcp_server.tools.progression_levels import _format_levels_output
    output = _format_levels_output(mock_levels_response)
    assert "Zone Asymmetry" in output
    assert "relative strength" in output


def test_format_levels_output_empty_zones():
    from intervals_mcp_server.tools.progression_levels import _format_levels_output
    output = _format_levels_output({"zones": {}, "ftp": 280})
    assert "No progression levels" in output


def test_format_correction_output_fields():
    from intervals_mcp_server.tools.progression_levels import _format_correction_output
    data = {
        "zone": "sweet_spot",
        "original_computed_level": 3.5,
        "corrected_to": 5.0,
        "rationale": "Felt strong in last block",
        "expires_at": "2026-07-15T00:00:00",
        "blend_behavior": "70/30 blend until expiry.",
    }
    output = _format_correction_output(data)
    assert "Sweet Spot" in output
    assert "3.5" in output
    assert "5.0" in output
    assert "Felt strong" in output
    assert "70/30 blend" in output


@pytest.mark.asyncio
@patch("intervals_mcp_server.tools.progression_levels.get_levels", new_callable=AsyncMock)
async def test_get_progression_levels_tool_invalid_zone(mock_get):
    from intervals_mcp_server.tools.progression_levels import get_progression_levels
    result = await get_progression_levels(zone="invalid_zone")
    assert "Unknown zone" in result
    mock_get.assert_not_called()


@pytest.mark.asyncio
@patch("intervals_mcp_server.tools.progression_levels.get_levels", new_callable=AsyncMock)
async def test_get_progression_levels_tool_unavailable(mock_get):
    mock_get.return_value = None
    from intervals_mcp_server.tools.progression_levels import get_progression_levels
    result = await get_progression_levels()
    assert "unavailable" in result.lower()


@pytest.mark.asyncio
@patch("intervals_mcp_server.tools.progression_levels.post_level_correction", new_callable=AsyncMock)
async def test_correct_progression_level_tool_invalid_zone(mock_post):
    from intervals_mcp_server.tools.progression_levels import correct_progression_level
    result = await correct_progression_level(zone="invalid", proposed_level=5.0, rationale="test")
    assert "Unknown zone" in result
    mock_post.assert_not_called()


@pytest.mark.asyncio
@patch("intervals_mcp_server.tools.progression_levels.post_level_correction", new_callable=AsyncMock)
async def test_correct_progression_level_tool_out_of_range(mock_post):
    from intervals_mcp_server.tools.progression_levels import correct_progression_level
    result = await correct_progression_level(zone="threshold", proposed_level=11.0, rationale="test")
    assert "1.0" in result and "10.0" in result
    mock_post.assert_not_called()


@pytest.mark.asyncio
@patch("intervals_mcp_server.tools.progression_levels.post_level_correction", new_callable=AsyncMock)
async def test_correct_progression_level_tool_empty_rationale(mock_post):
    from intervals_mcp_server.tools.progression_levels import correct_progression_level
    result = await correct_progression_level(zone="threshold", proposed_level=5.0, rationale="   ")
    assert "rationale" in result.lower()
    mock_post.assert_not_called()
