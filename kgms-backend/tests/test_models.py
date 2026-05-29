from app.domain import IndexTarget, JobStatus, RetrievalMode, normalize_entity_type
from app.models import Document


def test_domain_enums_and_force_unit_display_name() -> None:
    assert IndexTarget.BOTH.value == "both"
    assert JobStatus.COMPLETED.value == "completed"
    assert RetrievalMode.HYBRID.value == "hybrid"
    assert normalize_entity_type("force_unit").display_name == "部队/军事力量"


def test_document_defaults_to_pending_index_statuses() -> None:
    document = Document(
        original_filename="report.pdf",
        content_type="application/pdf",
        sha256="a" * 64,
        size_bytes=123,
        storage_path="uploads/example/report.pdf",
    )

    assert document.lightrag_status == JobStatus.PENDING.value
    assert document.pageindex_status == JobStatus.PENDING.value
