from datetime import UTC, datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.domain import JobStatus


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class Document(TimestampMixin, Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    lightrag_track_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lightrag_doc_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lightrag_status: Mapped[str] = mapped_column(
        String(32),
        default=JobStatus.PENDING.value,
        nullable=False,
    )
    lightrag_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pageindex_status: Mapped[str] = mapped_column(
        String(32),
        default=JobStatus.PENDING.value,
        nullable=False,
    )
    pageindex_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    pageindex_document: Mapped[Optional["PageIndexDocument"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        uselist=False,
    )
    pageindex_tree_nodes: Mapped[list["PageIndexTreeNode"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    pageindex_hits: Mapped[list["PageIndexHit"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("lightrag_status", JobStatus.PENDING.value)
        kwargs.setdefault("pageindex_status", JobStatus.PENDING.value)
        super().__init__(**kwargs)


class PageIndexDocument(TimestampMixin, Base):
    __tablename__ = "pageindex_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    pageindex_doc_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    remote_status: Mapped[str] = mapped_column(
        String(64),
        default=JobStatus.UNKNOWN.value,
        nullable=False,
    )
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tree_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    ocr_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    document: Mapped["Document"] = relationship(back_populates="pageindex_document")
    tree_nodes: Mapped[list["PageIndexTreeNode"]] = relationship(
        back_populates="pageindex_document",
        cascade="all, delete-orphan",
    )


class PageIndexTreeNode(TimestampMixin, Base):
    __tablename__ = "pageindex_tree_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pageindex_document_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("pageindex_documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    node_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    parent_node_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    title_path: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    page_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    document: Mapped["Document"] = relationship(back_populates="pageindex_tree_nodes")
    pageindex_document: Mapped[Optional["PageIndexDocument"]] = relationship(
        back_populates="tree_nodes"
    )


class PageIndexHit(TimestampMixin, Base):
    __tablename__ = "pageindex_hits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    node_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    page_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    relevant_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    document: Mapped[Optional["Document"]] = relationship(back_populates="pageindex_hits")
