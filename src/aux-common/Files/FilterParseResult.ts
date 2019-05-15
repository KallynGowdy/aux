export type FilterParseResult = FilterParseSuccess | FilterParseFailure;

export interface FilterParseSuccess {
    success: true;
    eventName: string;
    tag: string;
    filter: {
        tag: string;
        value: any;
    };
}

export interface FilterParseFailure {
    success: false;
    partialSuccess: boolean;
    tag: string;
    eventName: string;
}
