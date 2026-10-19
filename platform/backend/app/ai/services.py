"""Builds the AI service container once per app (settings → provider → gateway → services)."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import sessionmaker

from ..content.store import ContentStore
from .exercises import ExerciseService
from .gateway import AIGateway
from .knowledge import KnowledgeBase
from .placement import PlacementService
from .provider import AIProvider, DisabledProvider, OpenAIProvider
from .settings import AISettings, load_settings
from .pronunciation import PronunciationService
from .speaking import SpeakingService
from .studio import StudioService
from .tutor import TutorService
from .writing import WritingService


@dataclass
class AIServices:
    settings: AISettings
    gateway: AIGateway
    kb: KnowledgeBase
    tutor: TutorService
    exercises: ExerciseService
    writing: WritingService
    speaking: SpeakingService
    pronunciation: PronunciationService
    studio: StudioService
    placement: PlacementService


def make_provider(settings: AISettings) -> AIProvider:
    if settings.provider == "fake":
        from .fake import FakeProvider  # test/E2E double — never used unless AI_PROVIDER=fake

        return FakeProvider()
    if settings.provider == "openai" and settings.api_key:
        return OpenAIProvider(settings)
    return DisabledProvider()


def build(store: ContentStore, session_factory: sessionmaker, settings: AISettings | None = None,
          provider: AIProvider | None = None) -> AIServices:
    settings = settings or load_settings()
    gateway = AIGateway(settings, provider or make_provider(settings), session_factory)
    kb = KnowledgeBase(store)
    exercises = ExerciseService(gateway, store, kb)
    pron = PronunciationService(gateway)
    return AIServices(settings=settings, gateway=gateway, kb=kb, tutor=TutorService(gateway, store, kb), exercises=exercises,
                      writing=WritingService(gateway, store, kb), speaking=SpeakingService(gateway, store, pron), pronunciation=pron,
                      studio=StudioService(gateway, store, kb, exercises), placement=PlacementService(gateway, store))
