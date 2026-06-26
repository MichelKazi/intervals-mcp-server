class ServiceError(Exception):
    """Raised by service functions on upstream failure; routes map to JSON + status."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
