import { SpanExporter, ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { ExportResult } from "@opentelemetry/core";
/**
 * Configuration for the FreeplayExporter.
 */
export interface FreeplayConfig {
    /**
     * The base URL of the Freeplay API.
     * Defaults to "https://app.freeplay.ai/" if not specified.
     */
    baseUrl?: string;
    /**
     * The Freeplay project ID to associate the telemetry data with.
     */
    projectId: string;
    /**
     * The API key for authentication with the Freeplay API.
     */
    apiKey: string;
    /**
     * The environment (e.g., 'prod', 'dev', 'staging') where the telemetry is generated.
     * Used to categorize telemetry data within Freeplay.
     */
    environment: string;
}
/**
 * FreeplayExporter class for exporting OpenTelemetry spans to Freeplay's API.
 * This class implements the SpanExporter interface and provides support for
 * short-lived environments like Vercel Cloud Functions.
 */
export declare class FreeplayExporter implements SpanExporter {
    private baseUrl;
    private projectId;
    private apiKey;
    private environment;
    private pendingExports;
    /**
     * Constructs a new FreeplayExporter instance.
     * @param {FreeplayConfig} config - Configuration for the exporter.
     */
    constructor(config: FreeplayConfig);
    /**
     * Formats a 32-character hex trace ID into a UUID format (8-4-4-4-12).
     * @param {string} traceId - The 32-character hex trace ID.
     * @returns {string} The formatted UUID.
     * @throws {Error} If the trace ID length is not 32 characters.
     */
    private formatTraceIdToUUID;
    /**
     * Extracts input parameters from span attributes prefixed with 'ai.telemetry.metadata.inputs.'.
     * @param {Record<string, any>} attributes - The span attributes.
     * @returns {Record<string, any>} A dictionary of input key-value pairs.
     */
    private extractInputs;
    /**
     * Exports an array of spans to the Freeplay API.
     * This implementation ignores the instrumentationScope property for backward compatibility.
     * @param {ReadableSpan[]} spans - Array of ReadableSpan objects from OpenTelemetry.
     * @param {(result: ExportResult) => void} resultCallback - Callback to report export success or failure.
     */
    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;
    /**
     * Flushes all pending exports by awaiting their completion.
     * @returns {Promise<void>}
     */
    forceFlush(): Promise<void>;
    /**
     * Shuts down the exporter, flushing pending exports and cleaning up.
     * @returns {Promise<void>}
     */
    shutdown(): Promise<void>;
}
