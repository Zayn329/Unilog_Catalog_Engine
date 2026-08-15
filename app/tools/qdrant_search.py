"""Deterministic product-specification embeddings and Qdrant retrieval."""

from __future__ import annotations

import hashlib
import os
import re
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from qdrant_client import QdrantClient, models

from app.models.domain import Product, ProductStatusEnum


class ProductEmbedding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    vector: list[float] = Field(min_length=1)


class SearchMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    sku: str = Field(min_length=1)
    score: float
    product: Product


def _spec_tokens(product: Product) -> list[str]:
    tokens = [product.category_id.casefold(), product.sku.casefold()]
    for attribute in sorted(product.attributes, key=lambda item: item.canonical_key):
        value = attribute.normalized_value or attribute.raw_value
        tokens.extend(
            re.findall(
                r"[a-z0-9]+(?:\.[0-9]+)?",
                f"{attribute.canonical_key} {value} {attribute.unit or ''}".casefold(),
            )
        )
    return tokens


def generate_spec_embedding(product: Product, dimensions: int = 128) -> ProductEmbedding:
    """Create a stable feature-hash embedding from a published product spec.

    This is intentionally local and deterministic. It provides lexical similarity
    for the service boundary without introducing a model download or an external
    inference dependency into the catalog ingestion path.
    """
    if not isinstance(product, Product):
        raise TypeError("generate_spec_embedding requires a Product")
    if dimensions < 8:
        raise ValueError("dimensions must be at least 8")

    vector = [0.0] * dimensions
    for token in _spec_tokens(product):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[index] += sign

    norm = sum(value * value for value in vector) ** 0.5
    if norm == 0.0:
        vector[0] = 1.0
        norm = 1.0
    vector = [float(value / norm) for value in vector]
    return ProductEmbedding(product_id=product.product_id, vector=vector)


class QdrantSearchService:
    """Owns the Qdrant collection used by the cross-reference application service."""

    def __init__(
        self,
        collection_name: str = "published_product_specs",
        *,
        location: str | None = None,
        url: str | None = None,
        client: QdrantClient | None = None,
        vector_size: int = 128,
    ) -> None:
        self.collection_name = collection_name
        self.vector_size = vector_size
        if client is not None:
            self.client = client
        elif location:
            self.client = QdrantClient(location=location)
        else:
            self.client = QdrantClient(
                url=url or os.getenv("QDRANT_URL", "http://localhost:6333"),
                api_key=os.getenv("QDRANT_API_KEY"),
            )
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        if not self.client.collection_exists(self.collection_name):
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
        for field_name in ("category_id", "status", "sku"):
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception as exc:
                # Qdrant returns an error when an index already exists. Collection
                # initialization remains idempotent, but unrelated errors surface.
                if "already exists" not in str(exc).casefold():
                    raise

    def upsert_product(self, product: Product) -> ProductEmbedding:
        if not isinstance(product, Product):
            raise TypeError("upsert_product requires a Product")
        if product.status is not ProductStatusEnum.PUBLISHED:
            raise ValueError("Only PUBLISHED products can be indexed for cross-reference")

        embedding = generate_spec_embedding(product, self.vector_size)
        self.client.upsert(
            collection_name=self.collection_name,
            wait=True,
            points=[
                models.PointStruct(
                    id=str(product.product_id),
                    vector=embedding.vector,
                    payload={
                        "product_id": str(product.product_id),
                        "sku": product.sku,
                        "category_id": product.category_id,
                        "status": product.status.value,
                        "product": product.model_dump(mode="json"),
                    },
                )
            ],
        )
        return embedding

    def search_similar(self, product: Product, limit: int = 3) -> list[SearchMatch]:
        if not isinstance(product, Product):
            raise TypeError("search_similar requires a Product")
        if limit < 1:
            raise ValueError("limit must be at least 1")

        embedding = generate_spec_embedding(product, self.vector_size)
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=embedding.vector,
            limit=limit,
            with_payload=True,
        )
        points = getattr(response, "points", response)
        matches: list[SearchMatch] = []
        for point in points:
            payload: dict[str, Any] = point.payload or {}
            product_payload = payload.get("product")
            if not product_payload:
                continue
            indexed_product = Product.model_validate(product_payload)
            matches.append(
                SearchMatch(
                    product_id=indexed_product.product_id,
                    sku=indexed_product.sku,
                    score=float(point.score),
                    product=indexed_product,
                )
            )
        return matches
