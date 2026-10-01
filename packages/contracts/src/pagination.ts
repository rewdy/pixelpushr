/** Parameters accepted by opted-in administration list requests. */
export type PageParams = { page: number; pageSize: number };

/** Metadata added to paged administration list responses. */
export type PageMetadata = PageParams & { total: number };

export type PagedList<Key extends string, Row> = Record<Key, Row[]> &
  PageMetadata;
