# Universal Provider Interface (UPI)

## Purpose

The Universal Provider Interface (UPI) exists so that any AI provider — Ollama, ComfyUI, Gemini, OpenAI, Anthropic, ElevenLabs, or any future provider — can be swapped out at any time without changes to the modules that consume it. It is the contract that makes "replace any AI at any time" an architectural guarantee rather than a hope.

## Design Principles

- Every provider implements the same interface, regardless of vendor.
- Callers (Agent Runtime, Workflow Engine, and all engines) never depend on a specific provider — only on the UPI contract.
- Providers must support fallback and retry (per Engineering Principle #14).
- Providers declare which capabilities they support; unsupported calls return a clear "not supported" error, never a silent failure or a partial/garbled result.

## Interface Definition

### GenerateText()
**Purpose:** Produce a text completion or chat response from a prompt.
**Signature:** `GenerateText(prompt, context?, max_tokens?, temperature?) -> TextResult`
**Input:** prompt (required), context (optional prior conversation/state), max_tokens (optional cap), temperature (optional randomness control)
**Returns:** generated text, token usage stats
**Errors:** InvalidPromptError, ProviderUnavailableError, RateLimitError, ContextTooLongError

### GenerateImage()
**Purpose:** Produce an image from a text description or reference parameters.
**Signature:** `GenerateImage(prompt, width?, height?, style?, negative_prompt?) -> ImageResult`
**Input:** prompt (required), width/height (optional dimensions), style (optional), negative_prompt (optional exclusions)
**Returns:** image data (or reference/URL), generation metadata
**Errors:** InvalidPromptError, UnsupportedResolutionError, ProviderUnavailableError, ContentPolicyError

### GenerateVideo()
**Purpose:** Produce a video clip from a text description, image reference, or storyboard input.
**Signature:** `GenerateVideo(prompt, duration?, reference_image?, resolution?) -> VideoResult`
**Input:** prompt (required), duration (optional length in seconds), reference_image (optional starting frame/character reference), resolution (optional)
**Returns:** video data/reference, frame count, duration, generation metadata
**Errors:** InvalidPromptError, UnsupportedDurationError, ProviderUnavailableError, RenderTimeoutError

### GenerateAudio()
**Purpose:** Produce non-speech audio (music, sound effects, ambience) from a description.
**Signature:** `GenerateAudio(prompt, duration?, format?) -> AudioResult`
**Input:** prompt (required), duration (optional), format (optional output format)
**Returns:** audio data/reference, duration, format
**Errors:** InvalidPromptError, UnsupportedFormatError, ProviderUnavailableError

### EditVideo()
**Purpose:** Apply modifications to an existing video (trim, effects, compositing, style transfer).
**Signature:** `EditVideo(source_video, instructions, region?) -> VideoResult`
**Input:** source_video (required), instructions (required description of edit), region (optional timestamp/spatial bounds)
**Returns:** edited video data/reference, edit summary
**Errors:** InvalidSourceError, UnsupportedEditError, ProviderUnavailableError

### Upscale()
**Purpose:** Increase the resolution/quality of an existing image or video asset.
**Signature:** `Upscale(source_asset, target_resolution?, factor?) -> AssetResult`
**Input:** source_asset (required), target_resolution or factor (at least one required)
**Returns:** upscaled asset data/reference
**Errors:** InvalidSourceError, UnsupportedScaleError, ProviderUnavailableError

### LipSync()
**Purpose:** Align a character's mouth movements in video to a given audio track.
**Signature:** `LipSync(source_video, audio_track, character_region?) -> VideoResult`
**Input:** source_video (required), audio_track (required), character_region (optional if multiple characters present)
**Returns:** synced video data/reference, sync confidence score
**Errors:** InvalidSourceError, AudioMismatchError, NoFaceDetectedError, ProviderUnavailableError

### Speech()
**Purpose:** Convert text to spoken audio (text-to-speech) in a specified voice.
**Signature:** `Speech(text, voice_id?, language?, speed?) -> AudioResult`
**Input:** text (required), voice_id (optional voice/character selection), language (optional), speed (optional)
**Returns:** audio data/reference, duration
**Errors:** InvalidTextError, VoiceNotFoundError, ProviderUnavailableError

### Embedding()
**Purpose:** Convert text, image, or other content into a vector representation for search, similarity, or memory storage.
**Signature:** `Embedding(content, content_type) -> EmbeddingResult`
**Input:** content (required), content_type (required: text/image/audio)
**Returns:** vector array, dimensionality, model identifier
**Errors:** UnsupportedContentTypeError, ProviderUnavailableError

### Reason()
**Purpose:** Perform multi-step reasoning or planning over a given problem/context, distinct from a single text completion.
**Signature:** `Reason(problem, context?, max_steps?) -> ReasoningResult`
**Input:** problem (required), context (optional supporting state), max_steps (optional bound on reasoning depth)
**Returns:** reasoning trace (optional, if requested), final conclusion/plan
**Errors:** InvalidProblemError, ProviderUnavailableError, ReasoningTimeoutError

## Capability Declaration

Every provider registers a **capability manifest** at initialization time, declaring which of the ten UPI methods it actually supports (a provider is not required to implement all ten — e.g. a text-only provider declares only `GenerateText`, `Embedding`, and `Reason`). The Workflow Engine and Agent Runtime consult this manifest before routing a request, so a call is only ever sent to a provider that has declared support for it. If no registered provider supports a requested capability, the caller receives a `NoProviderAvailableError` rather than the request silently failing partway through a provider that doesn't actually support it.

## Error Handling & Fallback

Per Engineering Principle #14 ("Providers must support fallback and retry"), every UPI method call goes through a standard retry/fallback sequence:

1. Attempt the call on the primary registered provider for that capability.
2. On a transient error (rate limit, timeout, temporary unavailability), retry with backoff up to a configured limit.
3. If retries are exhausted, fall back to the next provider registered for that capability, if one exists.
4. If no provider succeeds, return a structured error to the caller — never a partial or fabricated result.

Non-transient errors (invalid input, content policy violations) are not retried or failed over — they are returned immediately, since switching providers won't resolve a bad request.

## Versioning

The UPI contract itself is versioned independently of any single provider implementation. Each provider declares which UPI version(s) it supports in its capability manifest. Breaking changes to the UPI (e.g. changing a method's required parameters) require a new major version; the Studio Kernel and Workflow Engine must be able to route calls correctly across providers implementing different UPI versions during a transition period.