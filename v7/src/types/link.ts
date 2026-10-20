export type LinkItem = {
    id: string;
    slug: string;
    short: string;
    long: string;
    isNew: boolean;
    createdAt: string;
};

export type User = {
    tier?: string;
};

export type ShortenResponse = {
    success: boolean;
    data?: LinkItem;
};

export type BackgroundMessage =
    | { type: "SHORTEN_URL"; payload: { url: string } }
    | { type: "GET_LINKS" }
    | { type: "GET_CURRENT_URL" }
    | { type: "GET_USER" }
    | { type: "DELETE_LINK" }
    | { type: "GET_LINKS_NUMBER" };
