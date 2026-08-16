import { type z } from "zod";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}
