from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import httpx


@dataclass(frozen=True)
class SupabaseObjectRef:
	bucket: str
	object_path: str


class StorageService:
	def __init__(self, timeout_seconds: float = 30.0) -> None:
		self.timeout_seconds = timeout_seconds
		self.supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
		self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

	def _parse_supabase_public_url(self, file_url: str) -> SupabaseObjectRef | None:
		parsed = urlparse(file_url)
		parts = [part for part in parsed.path.split("/") if part]

		# /storage/v1/object/public/{bucket}/{object_path...}
		if len(parts) < 6:
			return None

		if parts[:4] != ["storage", "v1", "object", "public"]:
			return None

		bucket = parts[4]
		object_path = unquote("/".join(parts[5:]))
		if not bucket or not object_path:
			return None

		return SupabaseObjectRef(bucket=bucket, object_path=object_path)

	def _download_direct(self, file_url: str) -> bytes | None:
		with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
			response = client.get(file_url)
			if response.status_code == 200:
				return response.content
			return None

	def _download_with_service_role(self, object_ref: SupabaseObjectRef) -> bytes | None:
		if not self.supabase_url or not self.service_role_key:
			return None

		storage_url = f"{self.supabase_url}/storage/v1/object/{object_ref.bucket}/{object_ref.object_path}"
		headers = {
			"apikey": self.service_role_key,
			"Authorization": f"Bearer {self.service_role_key}",
		}

		with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
			response = client.get(storage_url, headers=headers)
			if response.status_code == 200:
				return response.content
			return None

	def download_file_bytes(self, file_url: str) -> bytes:
		direct_content = self._download_direct(file_url)
		if direct_content is not None:
			return direct_content

		object_ref = self._parse_supabase_public_url(file_url)
		if object_ref is not None:
			service_content = self._download_with_service_role(object_ref)
			if service_content is not None:
				return service_content

		raise RuntimeError("스토리지 파일을 다운로드하지 못했습니다.")
