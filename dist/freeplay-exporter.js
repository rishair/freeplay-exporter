/**
 * FreeplayExporter class for exporting OpenTelemetry spans to Freeplay's API.
 * This class implements the SpanExporter interface and provides support for
 * short-lived environments like Vercel Cloud Functions.
 */
export class FreeplayExporter {
    /**
     * Constructs a new FreeplayExporter instance.
     * @param {FreeplayConfig} config - Configuration for the exporter.
     */
    constructor(config) {
        this.pendingExports = [];
        this.baseUrl = config.baseUrl || "https://app.freeplay.ai/api/v2";
        this.projectId = config.projectId;
        this.apiKey = config.apiKey;
        this.environment = config.environment;
    }
    /**
     * Formats a 32-character hex trace ID into a UUID format (8-4-4-4-12).
     * @param {string} traceId - The 32-character hex trace ID.
     * @returns {string} The formatted UUID.
     * @throws {Error} If the trace ID length is not 32 characters.
     */
    formatTraceIdToUUID(traceId) {
        if (traceId.length !== 32) {
            throw new Error("Invalid traceId length; expected 32 characters");
        }
        return `${traceId.slice(0, 8)}-${traceId.slice(8, 12)}-${traceId.slice(12, 16)}-${traceId.slice(16, 20)}-${traceId.slice(20)}`;
    }
    /**
     * Extracts input parameters from span attributes prefixed with 'ai.telemetry.metadata.inputs.'.
     * @param {Record<string, any>} attributes - The span attributes.
     * @returns {Record<string, any>} A dictionary of input key-value pairs.
     */
    extractInputs(attributes) {
        const inputs = {};
        for (const [key, value] of Object.entries(attributes)) {
            if (key.startsWith("ai.telemetry.metadata.inputs.")) {
                const inputKey = key.slice("ai.telemetry.metadata.inputs.".length);
                if (value !== null && value !== undefined) {
                    inputs[inputKey] = value;
                }
            }
        }
        return inputs;
    }
    /**
     * Exports an array of spans to the Freeplay API.
     * This implementation ignores the instrumentationScope property for backward compatibility.
     * @param {ReadableSpan[]} spans - Array of ReadableSpan objects from OpenTelemetry.
     * @param {(result: ExportResult) => void} resultCallback - Callback to report export success or failure.
     */
    export(spans, resultCallback) {
        const promises = [];
        for (const span of spans) {
            // Filter for relevant span names
            if (["ai.generateText.doGenerate", "ai.streamText.doStream"].includes(span.name)) {
                // Extract trace ID and convert to UUID for session ID
                const traceId = span.spanContext().traceId;
                let sessionId;
                try {
                    sessionId = this.formatTraceIdToUUID(traceId);
                }
                catch (e) {
                    const error = e;
                    console.warn(`Skipping span ${span.name} due to invalid traceId: ${error.message}`);
                    continue;
                }
                // Extract prompt template version ID
                const functionId = span.attributes["ai.telemetry.functionId"];
                if (!functionId) {
                    console.warn(`Missing ai.telemetry.functionId for span ${span.name}`);
                    continue;
                }
                // Parse prompt messages
                let messages = [];
                const promptMessagesStr = span.attributes["ai.prompt.messages"];
                if (promptMessagesStr) {
                    try {
                        messages = JSON.parse(promptMessagesStr);
                    }
                    catch (e) {
                        const error = e;
                        console.warn(`Failed to parse ai.prompt.messages for span ${span.name}: ${error.message}`);
                        continue;
                    }
                }
                else {
                    console.warn(`Missing ai.prompt.messages for span ${span.name}`);
                    continue;
                }
                // Append assistant response if available
                const responseText = span.attributes["ai.response.text"];
                if (responseText) {
                    messages.push({ role: "assistant", content: String(responseText) });
                }
                // Extract inputs
                const inputs = this.extractInputs(span.attributes);
                // Construct the payload
                const payload = {
                    messages,
                    inputs,
                    prompt_info: {
                        prompt_template_version_id: functionId,
                        environment: this.environment,
                    },
                };
                // Build the API endpoint
                const url = `${this.baseUrl}/projects/${this.projectId}/sessions/${sessionId}/completions`;
                // Create the POST request promise
                const promise = fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(payload),
                })
                    .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                })
                    .catch((error) => {
                    const err = error instanceof Error ? error : new Error(String(error));
                    console.error(`Failed to export span ${span.name} to Freeplay: ${err.message}`);
                })
                    .finally(() => {
                    // Remove the promise from pendingExports once it settles
                    this.pendingExports = this.pendingExports.filter((p) => p !== promise);
                });
                this.pendingExports.push(promise);
                promises.push(promise);
            }
        }
        // If no spans to process, report success immediately
        if (promises.length === 0) {
            resultCallback({ code: 0 }); // Success
            return;
        }
        // Wait for all promises to settle and determine overall result
        Promise.allSettled(promises).then((results) => {
            const failed = results.filter((r) => r.status === "rejected");
            if (failed.length > 0) {
                resultCallback({
                    code: 1, // Failure
                    error: new Error(`Failed to export ${failed.length} span(s)`),
                });
            }
            else {
                resultCallback({ code: 0 }); // Success
            }
        });
    }
    /**
     * Flushes all pending exports by awaiting their completion.
     * @returns {Promise<void>}
     */
    async forceFlush() {
        await Promise.all(this.pendingExports);
    }
    /**
     * Shuts down the exporter, flushing pending exports and cleaning up.
     * @returns {Promise<void>}
     */
    async shutdown() {
        await this.forceFlush();
        this.pendingExports = [];
    }
}
