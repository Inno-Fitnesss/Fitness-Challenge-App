"""Глобальный предохранитель от реальной почты в тестах.

Рядом с backend/ может лежать боевой .env с живыми SMTP-кредами (Gmail), и
python-decouple подхватывает его и в тестах. Тогда каждый signup в сьюте
(a) реально шлёт письмо на несуществующий *@example.com — бонсы о недоставке
падают в настроенный ящик, и (b) включает обязательную верификацию email,
ломая все тесты, написанные до этой фичи.

Поэтому по умолчанию сьют всегда работает в режиме «SMTP не настроен».
Тесты, которым нужен настроенный режим (test_email_verification), сами
переопределяют is_configured и перехватывают send_* — их фикстуры выполняются
после autouse-фикстур и потому выигрывают.
"""
import pytest

from app.core.mailer import Mailer


@pytest.fixture(autouse=True)
def _no_real_email(monkeypatch):
    monkeypatch.setattr(Mailer, "is_configured", staticmethod(lambda: False))

    def _refuse(*args, **kwargs):
        raise AssertionError(
            "Тест попытался отправить настоящее письмо через SMTP — "
            "замокайте Mailer.send_* в этом тесте")

    monkeypatch.setattr(Mailer, "_send", staticmethod(_refuse))
