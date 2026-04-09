from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from psycopg import connect
from psycopg.rows import dict_row


class DatabaseService:
	def __init__(self, database_url: str) -> None:
		self.database_url = database_url
		self.conninfo, self.connect_kwargs = self._normalize_database_url(database_url)

	def _normalize_database_url(self, database_url: str) -> tuple[str, dict[str, str]]:
		parts = urlsplit(database_url)
		query_items = parse_qsl(parts.query, keep_blank_values=True)

		schema = None
		filtered_query: list[tuple[str, str]] = []
		for key, value in query_items:
			if key == "schema":
				schema = value
				continue
			filtered_query.append((key, value))

		clean_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(filtered_query), parts.fragment))
		kwargs: dict[str, str] = {}
		if schema:
			kwargs["options"] = f"-c search_path={schema}"

		return clean_url, kwargs

	def _normalize_query(self, query: str) -> str:
		normalized = query
		normalized = normalized.replace("INSERT OR IGNORE INTO", "INSERT INTO")
		normalized = normalized.replace("?", "%s")

		if "INSERT INTO" in normalized and "ON CONFLICT" not in normalized:
			trimmed = normalized.rstrip()
			if trimmed.endswith(";"):
				trimmed = trimmed[:-1]
			normalized = f"{trimmed} ON CONFLICT DO NOTHING"

		return normalized

	@contextmanager
	def connect(self):
		connection = connect(self.conninfo, row_factory=dict_row, **self.connect_kwargs)
		try:
			yield connection
		finally:
			connection.close()

	def fetch_all(self, query: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
		with self.connect() as connection:
			with connection.cursor() as cursor:
				cursor.execute(self._normalize_query(query), tuple(params))
				rows = cursor.fetchall()
				return [dict(row) for row in rows]

	def fetch_one(self, query: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
		with self.connect() as connection:
			with connection.cursor() as cursor:
				cursor.execute(self._normalize_query(query), tuple(params))
				row = cursor.fetchone()
				return dict(row) if row is not None else None

	def execute(self, query: str, params: Iterable[Any] = ()) -> int:
		with self.connect() as connection:
			with connection.cursor() as cursor:
				cursor.execute(self._normalize_query(query), tuple(params))
				connection.commit()
				return cursor.rowcount

	def execute_many(self, query: str, params: list[tuple[Any, ...]]) -> None:
		if not params:
			return

		with self.connect() as connection:
			with connection.cursor() as cursor:
				cursor.executemany(self._normalize_query(query), params)
				connection.commit()
