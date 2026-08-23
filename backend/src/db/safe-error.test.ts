import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicMongoErrorMessage, stripMongoSecrets } from "./safe-error";

describe("MongoDB safe errors", () => {
  it("redacts connection strings from text", () => {
    const leaked =
      "query srv localhost failed mongodb+srv://user:secret-password@cluster.example.net/app";
    const redacted = stripMongoSecrets(leaked);

    assert.equal(redacted.includes("secret-password"), false);
    assert.equal(redacted.includes("mongodb+srv://"), false);
    assert.equal(redacted.includes("[redacted]"), true);
  });

  it("never returns credentials in the public error message", () => {
    const error = new Error(
      "connect failed mongodb://admin:super-secret@127.0.0.1:27017/revive",
    );
    const message = publicMongoErrorMessage(error);

    assert.equal(message, "MongoDB connection failed");
    assert.equal(message.includes("super-secret"), false);
    assert.equal(message.includes("mongodb://"), false);
  });
});
