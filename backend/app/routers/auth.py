from fastapi import APIRouter, BackgroundTasks, Depends
from app.db.schema.user import (UserInCreate, UserInLogin, UserWithToken, UserOutput,
                                RefreshIn, GoogleLoginIn, ForgotPasswordIn, ResetPasswordIn)
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.service.userService import UserService

authRouter = APIRouter()


@authRouter.post("/refresh", status_code=200, response_model=UserWithToken)
def refresh(body: RefreshIn, session: Session = Depends(get_db)):
    return UserService(session=session).refresh(refresh_token=body.refresh_token)

@authRouter.post("/login", status_code=200, response_model=UserWithToken)
def login(loginDetails: UserInLogin, session: Session = Depends(get_db)):
    try:
        return UserService(session=session).login(login_details=loginDetails)
    except Exception as error:
        print(error)
        raise error

@authRouter.post("/google", status_code=200, response_model=UserWithToken)
def googleLogin(body: GoogleLoginIn, session: Session = Depends(get_db)):
    return UserService(session=session).login_with_google(id_token=body.id_token)

@authRouter.post("/forgot-password", status_code=200)
def forgotPassword(body: ForgotPasswordIn, background_tasks: BackgroundTasks,
                   session: Session = Depends(get_db)):
    return UserService(session=session).forgot_password(
        email=body.email, background_tasks=background_tasks)

@authRouter.post("/reset-password", status_code=200)
def resetPassword(body: ResetPasswordIn, session: Session = Depends(get_db)):
    return UserService(session=session).reset_password(
        email=body.email, code=body.code, new_password=body.new_password)

@authRouter.post("/signup", status_code=201, response_model=UserOutput)
def signUp(signUpDetails: UserInCreate, session: Session = Depends(get_db)):
    try:
        return UserService(session=session).signup(user_details=signUpDetails)
    except Exception as error:
        print(error)
        raise error
