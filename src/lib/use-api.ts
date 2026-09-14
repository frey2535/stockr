"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApiJson, readApiCache, writeApiCache } from "./api-cache";
import { WORKSPACE_PAGE_SIZE } from "./types";

export function useApi<T>(url: string | null) {
  const cached = url ? readApiCache<T>(url) : undefined;
  const [live, setLive] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(Boolean(url) && cached === undefined);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => {
        setLive(null);
        setPending(false);
        setError("");
      });
      return;
    }

    let cancelled = false;
    if (readApiCache<T>(url) === undefined) {
      queueMicrotask(() => setPending(true));
    }

    fetchApiJson<T>(url)
      .then((json) => {
        if (cancelled) return;
        setLive(json);
        setError("");
        setPending(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "Could not load data.");
        setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => {
    setPending(true);
    setNonce((value) => value + 1);
  }, []);

  return {
    data: cached ?? live,
    loading: cached === undefined && pending,
    error,
    reload,
  };
}

type Paged<R> = { rows: R[]; total: number };

export function usePagedApi<T extends Paged<T["rows"][number]>>(baseUrl: string) {
  const [page, setPage] = useState({ url: baseUrl, offset: 0 });
  const firstUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}limit=${WORKSPACE_PAGE_SIZE}&offset=0`;
  const cachedFirst = readApiCache<T>(firstUrl);
  const [live, setLive] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(cachedFirst === undefined);

  if (page.url !== baseUrl) {
    setPage({ url: baseUrl, offset: 0 });
  }

  const offset = page.url === baseUrl ? page.offset : 0;

  useEffect(() => {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}limit=${WORKSPACE_PAGE_SIZE}&offset=${offset}`;
    let cancelled = false;
    if (offset === 0 && readApiCache<T>(url) === undefined) {
      queueMicrotask(() => setPending(true));
    }

    fetchApiJson<T>(url)
      .then((json) => {
        if (cancelled) return;
        setLive((prev) => {
          if (!prev || offset === 0) {
            writeApiCache(url, json);
            return json;
          }
          return { ...json, rows: [...prev.rows, ...json.rows] };
        });
        setError("");
        setPending(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "Could not load data.");
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, offset, nonce]);

  const loadMore = useCallback(() => {
    setPending(true);
    setPage((current) => ({ ...current, offset: current.offset + WORKSPACE_PAGE_SIZE }));
  }, []);

  const reload = useCallback(() => {
    setPage((current) => ({ ...current, offset: 0 }));
    setPending(true);
    setNonce((value) => value + 1);
  }, []);

  const data = offset === 0 ? (cachedFirst ?? live) : live;

  return {
    data,
    loading: (offset === 0 ? cachedFirst === undefined : true) && pending,
    error,
    hasMore: Boolean(data && data.rows.length < data.total),
    loadMore,
    reload,
  };
}
