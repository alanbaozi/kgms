from dataclasses import dataclass
from enum import Enum


class IndexTarget(str, Enum):
    LIGHTRAG = "lightrag"
    PAGEINDEX = "pageindex"
    BOTH = "both"


class JobStatus(str, Enum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    SYNCED = "synced"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    UNKNOWN = "unknown"


class RetrievalMode(str, Enum):
    NATIVE = "native"
    LIGHTRAG = "lightrag"
    PAGEINDEX = "pageindex"
    HYBRID = "hybrid"
    SMART = "smart"


@dataclass(frozen=True)
class EntityTypeInfo:
    key: str
    display_name: str
    color: str


ENTITY_TYPE_DISPLAY = {
    "country": EntityTypeInfo(key="country", display_name="国家", color="#c2410c"),
    "force_unit": EntityTypeInfo(
        key="force_unit", display_name="部队/军事力量", color="#1d4ed8"
    ),
    "organization": EntityTypeInfo(
        key="organization", display_name="组织机构", color="#475569"
    ),
    "person": EntityTypeInfo(key="person", display_name="人员", color="#7c3aed"),
    "equipment": EntityTypeInfo(key="equipment", display_name="装备", color="#0891b2"),
    "facility": EntityTypeInfo(key="facility", display_name="设施", color="#92400e"),
    "location": EntityTypeInfo(key="location", display_name="地点", color="#16a34a"),
    "region": EntityTypeInfo(key="region", display_name="区域", color="#4d7c0f"),
    "event": EntityTypeInfo(key="event", display_name="事件", color="#ea580c"),
    "action": EntityTypeInfo(key="action", display_name="动作", color="#ca8a04"),
    "capability": EntityTypeInfo(key="capability", display_name="能力", color="#0f766e"),
    "indicator": EntityTypeInfo(
        key="indicator", display_name="指标/属性值", color="#db2777"
    ),
    "resource": EntityTypeInfo(key="resource", display_name="资源", color="#a16207"),
    "time": EntityTypeInfo(key="time", display_name="时间", color="#64748b"),
    "plan": EntityTypeInfo(key="plan", display_name="计划/方案", color="#4338ca"),
    "document": EntityTypeInfo(
        key="document", display_name="文档/资料", color="#94a3b8"
    ),
    "other": EntityTypeInfo(key="other", display_name="其他", color="#737373"),
}


def normalize_entity_type(value: str | None) -> EntityTypeInfo:
    if not value:
        return ENTITY_TYPE_DISPLAY["other"]

    normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    return ENTITY_TYPE_DISPLAY.get(normalized, ENTITY_TYPE_DISPLAY["other"])
