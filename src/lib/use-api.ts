"use client";

import { useCallback, useEffect, useState } from "react";
import { WORKSPACE_PAGE_SIZE } from "./types";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => {
        setData(null);
        setLoading(false);
        setError("");
      });
      return;
    }

    let cancelled = false;
    fetch(url)
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
        if (cancelled) return;
        if (!response.ok) {
          setError(json && typeof json === "object" && "error" in json ? String(json.error) : "Could not load data.");
          setLoading(false);
          return;
        }
        setData(json as T);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load data.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((value) => value + 1);
  }, []);

  return { data, loading, error, reload };
}

type Paged<R> = { rows: R[]; total: number };

export function usePagedApi<T extends Paged<T["rows"][number]>>(baseUrl: string) {
  const [page, setPage] = useState({ url: baseUrl, offset: 0 });
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  if (page.url !== baseUrl) {
    setPage({ url: baseUrl, offset: 0 });
    setLoading(true);
    setData(null);
  }

  const offset = page.url === baseUrl ? page.offset : 0;

  useEffect(() => {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}limit=${WORKSPACE_PAGE_SIZE}&offset=${offset}`;
    let cancelled = false;
    fetch(url)
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
        if (cancelled) return;
        if (!response.ok || !json) {
          setError(json && typeof json === "object" && "error" in json ? String(json.error) : "Could not load data.");
          setLoading(false);
          return;
        }
        setData((prev) => {
          if (!prev || offset === 0) return json;
          return { ...json, rows: [...prev.rows, ...json.rows] };
        });
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load data.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, offset, nonce]);

  const loadMore = useCallback(() => {
    setLoading(true);
    setPage((current) => ({ ...current, offset: current.offset + WORKSPACE_PAGE_SIZE }));
  }, []);

  const reload = useCallback(() => {
    setPage((current) => ({ ...current, offset: 0 }));
    setLoading(true);
    setNonce((value) => value + 1);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore: Boolean(data && data.rows.length < data.total),
    loadMore,
    reload,
  };
}
