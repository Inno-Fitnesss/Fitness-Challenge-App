from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db.schema.admin import AdminLoginIn, AdminLoginOut, AdminStatsOut
from app.service.adminService import AdminService
from app.util.protectRoute import get_current_admin

adminRouter = APIRouter()


@adminRouter.post("/login", status_code=200, response_model=AdminLoginOut)
def admin_login(body: AdminLoginIn):
    token = AdminService.login(password=body.password)
    return AdminLoginOut(token=token)


@adminRouter.get(
    "/stats", status_code=200, response_model=AdminStatsOut,
    dependencies=[Depends(get_current_admin)],
)
def admin_stats(db: Session = Depends(get_db)):
    return AdminService.get_stats(db)