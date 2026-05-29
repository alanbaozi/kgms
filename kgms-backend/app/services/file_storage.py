import json
import os
import shutil
import tempfile
from hashlib import sha256
from pathlib import Path
from typing import Any, BinaryIO, Iterable


class FileStorage:
    CHUNK_SIZE = 1024 * 1024

    def __init__(self, storage_root: Path | str) -> None:
        self.storage_root = Path(storage_root)

    def save_upload(self, filename: str, source: BinaryIO) -> tuple[str, int, Path]:
        safe_filename = Path(filename).name or "upload.bin"
        temp_dir = self.storage_root / "uploads" / "_tmp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        digest = sha256()
        size_bytes = 0
        temp_fd, temp_name = tempfile.mkstemp(prefix="upload-", dir=temp_dir)
        os.close(temp_fd)
        temp_path = Path(temp_name)

        try:
            with temp_path.open("wb") as target:
                while True:
                    chunk = source.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    digest.update(chunk)
                    size_bytes += len(chunk)
                    target.write(chunk)

            hex_digest = digest.hexdigest()
            upload_dir = self.storage_root / "uploads" / hex_digest
            upload_dir.mkdir(parents=True, exist_ok=True)
            storage_path = upload_dir / safe_filename
            shutil.move(str(temp_path), storage_path)
            return hex_digest, size_bytes, storage_path
        finally:
            if temp_path.exists():
                temp_path.unlink()

    def pageindex_dir(self, document_id: int) -> Path:
        path = self.storage_root / "pageindex" / str(document_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def write_json(self, path: Path | str, data: Any) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
        return target

    def write_jsonl(self, path: Path | str, rows: Iterable[Any]) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as file:
            for row in rows:
                file.write(json.dumps(row, ensure_ascii=False))
                file.write("\n")
        return target

    def delete_document_artifacts(
        self,
        storage_path: Path | str,
        document_id: int,
        delete_upload_file: bool = True,
    ) -> list[str]:
        deleted: list[str] = []
        upload_path = self._safe_storage_path(storage_path)
        if (
            delete_upload_file
            and upload_path is not None
            and upload_path.exists()
            and upload_path.is_file()
        ):
            upload_path.unlink()
            deleted.append(str(upload_path))
            self._remove_empty_upload_dir(upload_path.parent)

        pageindex_path = self._safe_storage_path(self.storage_root / "pageindex" / str(document_id))
        if pageindex_path is not None and pageindex_path.exists():
            shutil.rmtree(pageindex_path)
            deleted.append(str(pageindex_path))
        return deleted

    def _safe_storage_path(self, path: Path | str) -> Path | None:
        root = self.storage_root.resolve()
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = Path.cwd() / candidate
        try:
            resolved = candidate.resolve()
            resolved.relative_to(root)
        except (OSError, ValueError):
            return None
        return resolved

    def _remove_empty_upload_dir(self, directory: Path) -> None:
        uploads_root = (self.storage_root / "uploads").resolve()
        try:
            directory.resolve().relative_to(uploads_root)
            directory.rmdir()
        except (OSError, ValueError):
            return
