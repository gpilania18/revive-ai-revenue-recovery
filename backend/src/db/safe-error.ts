const URI_PATTERN = /mongodb(\+srv)?:\/\/\S+/gi;

export function stripMongoSecrets(text: string): string {
  return text.replace(URI_PATTERN, "[redacted]");
}

export function publicMongoErrorMessage(_error: unknown): string {
  return "MongoDB connection failed";
}
