from pydantic import BaseModel


class WithingsAuthorizeUrl(BaseModel):
    authorize_url: str


class WithingsStatus(BaseModel):
    connected: bool


class WithingsSyncResult(BaseModel):
    synced_days: int
