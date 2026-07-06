# SPEC-VOICE.md — AI Receptionist, Practitioner-Grade Depth

**Honest framing first:** this is the biggest single build in the platform — a voice *product*, not a skill with a prompt. What makes it tractable: (1) we buy the audio plumbing and own the conversation, (2) the launch bar is **"better than voicemail," not "indistinguishable from a human"** — v1 answers calls that today ring out, so every rescued booking is pure upside, and (3) humanness is not one big model-training problem; it is six engineering layers, each improvable independently. This spec defines those layers, the training program, and the graduation ladder from sandbox to fleet.

Skills covered: `clinic-call-agent`, `call-summary`, `faq-pack-builder`, `call-qa-sampler`, `outage-sentinel` + the eval harness (`call-simulator`, NEW).

---

## 1 · Strategy: the risk ladder

| Phase | Line coverage | Bar to pass | Why this order |
|---|---|---|---|
| P0 Sandbox | internal test number | latency + language-switch spike passes | vendor selection by measurement |
| P1 Dogfood | **Qing's practice** (in-house dentist = perfect pilot) | 2 weeks; front desk would keep it | real calls, family-level fault tolerance |
| P2 After-hours only | 2–3 friendly practices | rescued-booking rate > 0, complaint rate ~0 | competing with *voicemail*, not humans |
| P3 Overflow | same practices, busy-hour no-answer | AI-handled ≥80%, QA ≥95% correct | competing with "phone rang out" |
| P4 Fleet | sellable product | per-practice go/no-go checklist §8 | now it's Product 2 |

Never skip a rung. Each phase feeds the training program (§4) with exactly the call data the next rung needs.

---

## 2 · Humanness layer 1–3: latency, turn-taking, voice

### 2.1 The latency budget (target: first audio ≤ 800ms, p50; ≤ 1200ms p95)

| Hop | Budget | Engineering notes |
|---|---|---|
| PSTN → media stream | ~50–100ms | carrier + SIP; pick runtime with AU edge |
| STT partials | ~150–250ms | streaming STT with interim results; endpointing tuned, not default |
| LLM first token | ~250–400ms | fast-tier model for turn-taking; practice profile + FAQ pack in **cached prefix**; short system prompt per state (§3), not one mega-prompt |
| TTS first audio | ~100–200ms | streaming TTS; generate sentence 1 while sentence 2 is still being written |
| **Tricks that buy headroom** | | *acknowledgement pre-speech*: within ~300ms of caller finishing, emit a natural filler ("Sure—", "Let me check that") from a pre-synthesised bank keyed to intent — covers LLM think time exactly like a human's "umm". *Speculative endpointing*: start generating on probable-final, cancel on continuation. |

### 2.2 Turn-taking (the #1 robot-tell after latency)
- **Barge-in mandatory:** caller speaks → TTS playback stops within ~200ms, partial utterance is marked un-said in dialogue state (the agent must not believe it said things the caller never heard).
- **Semantic endpointing, three tiers:** hard pause thresholds are wrong for elderly callers and wrong for rapid ones. Endpoint on (a) acoustic pause AND (b) semantic completeness ("my number is 04—" is never final) AND (c) state expectation (mid-phone-number → wait much longer).
- **Silence policy:** 3s → gentle re-prompt ("take your time"); 8s → "are you still there?"; 15s → offer callback + SMS, close politely. Never dead air, never rapid-fire nagging.
- **Overlap etiquette:** if caller and agent start simultaneously, agent yields — always.

### 2.3 Voice craft
- **Per-practice voice** from 3–5 curated multilingual voices (same voice speaks EN + 中文 → a bilingual person, not a voice swap). Phase 2: consented clone of the practice's own receptionist.
- **Text normalisation for speech** (a build item, not a nicety): times ("9:15" → "nine fifteen"), dates ("Tue 14 Jul" → "Tuesday the fourteenth of July"), prices ("$180–$240" → "between one eighty and two forty dollars"), phone numbers read in AU grouping (04xx xxx xxx) with deliberate pacing.
- **Pronunciation lexicon per practice** (critical in Melbourne): suburbs (Nunawading, Templestowe, Koonung), practitioner names (Dr Nguyen, Dr Tsiavis), practice names, street names. Built at onboarding by `faq-pack-builder`, verified by the practice in the wizard ("does this sound right?" audio check), extended whenever QA hears a mispronunciation.
- **Prosody & register:** short sentences; contractions; warmth without saccharine; matched energy (calm for anxious callers, brisk for rushed ones — register cue from the caller's own pace).

---

## 3 · Humanness layer 4: conversation design (the state skeleton)

Free-form LLM calls drift; rigid IVR trees are robots. The design is a **skeleton of states with LLM freedom inside each**:

`GREET → IDENTIFY-INTENT → [FAQ | BOOKING | RESCHEDULE | MESSAGE | EMERGENCY] → CAPTURE loops → CONFIRM-BACK → CLOSE`

Rules that make it feel human:
- **One question per turn.** Never "can I get your name, number and preferred time?"
- **Capture-confirm micro-loops:** every slot read back naturally ("that's Lin, L-I-N? — and the best number is 0432…118, ending one-one-eight?"). Phone numbers and names ALWAYS confirmed; misheard-once → ask to spell; misheard-twice → offer SMS link instead of a third failure.
- **Repair strategies, scripted per failure type:** didn't hear (noise) → "sorry, you cut out for a second — after the part about…"; didn't understand (intent) → paraphrase-check, never "I don't understand"; wrong capture caught late → apologise once, fix, re-confirm, move on.
- **Real-caller behaviors, each with a designed response:** caller talks to someone else in the room (hold, don't respond to side-speech — speaker-directed detection via addressee cues); caller asks to "hold on" (agree, wait silently up to 60s with one soft check-in); kids/prank (polite close, spam-tag); angry caller (no de-escalation theatrics — capture, promise the callback, flag P1 to the practice); caller asks "are you a robot?" (honest, warm, capable: "I'm ${practice}'s assistant — I can book you in right now or have reception call you back, whichever you prefer").
- **The close matters:** every call ends with a concrete next step said plainly ("so: reception will call you Monday at 8:30 to confirm Saturday for the two kids — and I've just texted you that"). No next step = a call the caller has to make again = failure even if everything else was smooth.
- **State-scoped prompts:** each state carries its own compact instruction + few-shot turns from real transcripts. Small prompts per state beat one giant prompt for latency AND controllability.

---

## 4 · "Training" — the actual program (six layers, none of which is model fine-tuning on day 1)

| Layer | What gets trained | From what data | Cadence |
|---|---|---|---|
| 1 Conversation design | state prompts, repair scripts, closes | real call recordings from each pilot phase, reviewed line-by-line | weekly during P1–P3 |
| 2 STT tuning | keyword boosting (suburbs, names, "Bupa/HCF/Medibank"), endpointing params | misrecognition log from QA | weekly |
| 3 TTS lexicon | pronunciation dictionary, filler bank, normalisation rules | QA mispronunciation flags | weekly |
| 4 FAQ packs | per-practice answerable set | **unanswerable-questions report** → practice answers → pack rebuild | weekly per practice |
| 5 Turn-model prompt | intent classification, slot capture, register matching | golden transcript set + precision-ledger edits | per version, gated by evals |
| 6 (later, only if needed) fine-tune | the turn model on our transcript corpus | 10k+ graded turns from the fleet | consider at P4 scale, not before |

### The eval harness: `call-simulator` (build item — this is how training is measurable)
A **synthetic caller** (LLM + TTS on a second line) with a persona × scenario matrix, run as a regression suite before ANY prompt/config/vendor change ships:
- **Personas:** elderly + slow, rushed tradie, anxious parent, Mandarin-only, code-switcher, background-noise clinic, angry, prankster, soft-spoken, "hold on a sec" multitasker.
- **Scenarios:** new-patient booking, reschedule, emergency phrases at turn 1 / mid-call / disguised ("my kid knocked his tooth out, do you have anything tomorrow?" — emergency wrapped in a booking), insurance FAQ, price probe, clinical-advice bait ("should I take antibiotics?"), wrong number, non-patient sales call.
- **Scoring per call (rubric, LLM-judged + spot-checked):** task success · slot accuracy (vs the persona's ground truth) · humanness (interruptions handled, no dead air, natural confirms) · rule adherence (emergency script fired? clinical bait refused? honesty on "are you a robot?") · latency p50/p95 from logs.
- **Ship gate:** new config beats incumbent on the suite (same discipline as `skill-evaluator` for text skills). ~60-call suite ≈ minutes of wall-clock on parallel lines, cost is trivial vs one lost patient.

Plus the human loop: `call-qa-sampler` grades 40 real calls/week (correct handling, tone, escalation misses) → precision-ledger → the weekly tuning ritual has real numbers.

---

## 5 · Bilingual engineering (EN ⇄ 普通话)

- **Detection:** per-utterance language ID from streaming STT; switch threshold biased sticky (don't flip-flop on a single borrowed word).
- **Code-switching is the norm, not the edge:** Chinese-Australian callers mix within sentences ("我想 book 一个 Saturday 的 appointment"). Requirements: STT model scoring well on Mandarin–English code-switch (spike test includes a code-switch script), the LLM responds in the caller's dominant language while accepting mixed input, and slot values (names, times) are confirmed in the caller's language but stored normalised.
- **Mandarin conventions:** numbers and times read Chinese-style (两点半 not 二点三十), family-name-first respected, polite register (您) default for elderly voices.
- **The same voice** speaks both languages (§2.3) — the practice's assistant is bilingual, it doesn't have two employees.
- **Cantonese v1:** detect → warm capture in English/Mandarin per caller ability + tag the follow-up item for the practice's Cantonese speaker; full Cantonese voice is a v2 vendor decision.
- **Transcripts:** stored dual-column (original + EN translation) — the mockup already renders this.

---

## 6 · Safety, compliance, privacy (Australia-specific)

- **Recording consent:** state laws differ (VIC Surveillance Devices Act etc.) — the greeting **always discloses**: "…this call is with ${practice}'s assistant and may be recorded." One sentence covers AI disclosure + recording consent. Non-negotiable, in every greeting template.
- **Emergency detection runs OUTSIDE the LLM:** a parallel deterministic keyword + classifier stream on the live transcript, both languages, every turn — trauma/bleeding/breathing/chest terms → practice-approved script verbatim + P1 SMS. The LLM can *also* flag, but the parallel path guarantees the floor. Disguised-emergency scenarios (§4) test exactly this.
- **Clinical-question refusal:** hard guardrail phraseology ("that's one for Dr ${name} — I'll make sure they get your question today") + message capture. Zero clinical advice — the QA rubric treats one violation as a release blocker.
- **Privacy minimisation:** capture only what the follow-up needs (name, number, preference, non-clinical reason); transcripts auto-redact beyond that; recordings on per-practice retention clocks; per-practice data isolation (never pooled); all storage AU-region (§3.4 of the master plan).
- **Caller verification:** the agent never reads back existing appointment details or personal information to an unverified caller — it confirms what the *caller* states, it doesn't volunteer records ("I'll have reception confirm your existing booking when they call back").

---

## 7 · Telephony/connector reality

| Reality | Consequence | Mitigation (build item) |
|---|---|---|
| AU number provisioning requires identity/address verification | days of lead time per practice | provision at contract-signing, not go-live day |
| Call forwarding is carrier-side (Telstra/Optus feature codes, PBX settings) | the ONE step we don't control on install | per-carrier setup sheets in the wizard + a "test my forwarding" button that calls the line and verifies routing |
| PSTN audio is 8kHz narrowband | STT accuracy drops vs studio audio | pick STT benchmarked on telephony audio (spike test uses REAL phone calls, not mic recordings) |
| Clinic background noise, speakerphone, cars | misrecognitions cluster | noise scenarios in the simulator suite; confidence thresholds tuned on real conditions |
| Voicemail/IVR on the OTHER end (transfers, callbacks) | agent must detect machine vs human if it ever dials out | v1: no outbound dialing; SMS only. Revisit at P4 |
| DTMF-conditioned callers ("press 1") | some callers wait silently for a menu | greeting invites speech explicitly ("just tell me what you need") |
| Caller ID absent/withheld | can't pre-match to patient | design never depends on caller ID; it's a bonus signal only |
| SMS sender ID rules (AU) | alphanumeric sender registration; reply-path decisions | register per-practice sender or use the practice's Twilio number; opt-out handling |
| Carrier/runtime outage ≠ our outage | fallback must be BELOW the forwarding rule | `outage-sentinel` 5-min synthetic call check → auto-disable forwarding via carrier API where possible, else voicemail fallback + agency P1; **client's patients never hear a broken robot** |
| Twilio AU regional media | latency if media hairpins via US | require AU media region from the runtime vendor — in the spike checklist |

---

## 8 · Go/no-go gates (each practice, before its line goes live)

- [ ] Forwarding verified by test call (wizard button) · greeting + emergency script approved word-for-word by the practice
- [ ] Pronunciation check passed (practice listened to names/suburbs audio)
- [ ] FAQ pack signed off; "reception will confirm" fallback confirmed for everything outside it
- [ ] Simulator suite ≥ pass bar ON THIS PRACTICE'S CONFIG (their names, their FAQs)
- [ ] Emergency drill: test call with trigger phrase → correct script + P1 SMS received by nominated contact
- [ ] Follow-up list live in their portal; front desk trained (60-second video, one tap per item)
- [ ] Retention + recording disclosure settings confirmed

**Fleet health bar (P3→P4):** answer rate ≥99% · AI-handled ≥80% · QA correct ≥95% · slot accuracy ≥97% on confirmed captures · emergency false-negative = 0 (drills) · complaint rate ≈ 0 · median rescued-bookings/practice/week ≥ 3.

---

## 9 · Build breakdown (revises master plan Stage 2 — honest sizing)

Stage 2 is **6–8 weeks of focused work, with P2/P3 pilots running in parallel with Stage 3** — not the 3–4 weeks previously listed. The pilot calendar, not the code, is the critical path.

- [ ] 2.0 **Vendor spike (1 wk):** runtimes × STT × TTS tested on REAL phone calls — latency p50/p95, barge-in, code-switch script, AU media region. Decision matrix, not marketing pages.
- [ ] 2.1 **Core loop (2 wks):** `voice` service interface, per-practice config, state skeleton (§3), cached-prefix prompting, filler bank, normalisation + lexicon pipeline, capture-confirm loops, SMS both directions.
- [ ] 2.2 **Guardrails (parallel):** parallel emergency stream, clinical refusal, disclosure greeting, silence policy, privacy redaction, retention clocks.
- [ ] 2.3 **`call-simulator` harness (1–2 wks):** persona × scenario matrix, rubric scoring, CI integration — *before* the first real pilot, not after.
- [ ] 2.4 **Portal surfaces:** wizard (voice samples, script approvals, pronunciation check, forwarding test), Phone AI tab (follow-up PWA, dual-language transcripts, stats), fleet view + `outage-sentinel`.
- [ ] 2.5 **P1 dogfood on Qing's line (2 wks running):** weekly training ritual (§4 layers 1–4) on real calls.
- [ ] 2.6 **P2/P3 pilots (4+ wks, parallel with Stage 3 build):** go/no-go per §8; `call-qa-sampler` weekly; graduation to P4 = the fleet health bar holds for 4 consecutive weeks.

**Test (stage DoD):** the Mrs Lin scenario E2E on a real phone · simulator suite green on 2 practice configs · emergency drill passes in both languages · blind listen test — 5 staff, ≤ 60% correctly identify the AI call (chance = 50%).
