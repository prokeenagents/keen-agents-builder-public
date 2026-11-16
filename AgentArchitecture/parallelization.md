# Parallelization

## What it is

Several LLM flows work on the same input **at the same time**, and their results are combined into one answer at the
end. There are two kinds:

- **Sectioning:** different flows each do a different part of the job (one checks the rules, one finds what is
  missing, one writes a title).
- **Voting:** the same flow runs several times on the same question, and the answers are counted.

Use it when the parts do not depend on each other and the person should not wait for them one by one, or when a yes /
no decision is worth several independent opinions. Do not use it when each step needs the previous step's result. A
chain does that ([prompt-chaining.md](prompt-chaining.md)). Do not use it when one LLM node can do all the parts in one
answer either: one call is cheaper, and the person sees less streamed text. When a model must decide *which* tasks to
run, use [orchestrator-worker.md](orchestrator-worker.md).

## On Keen

- [Parallel Flows](../Flow/Nodes/ParallelFlows/parallel-flows-skill.md) + one [Flow Pointer](../Flow/Nodes/FlowPointer/flow-pointer-skill.md) per flow: **sectioning**. Different flows run at once, and each branch starts with an **empty** dictionary that is deleted when the branch ends.
- [Parallel Context](../Flow/Nodes/ParallelContext/parallel-context-skill.md): **voting** (or sectioning by a `kind` field). One flow runs once per list element, and each run's dictionary is **merged** back into its element.
- [LLM](../Flow/Nodes/LLM/llm-skill.md): every reviewer and voter, each with its own model; the answering node combines.
- [Script](../Flow/Nodes/Script/script-skill.md): puts the input where the branches can read it, and collects the results into one text.
- [`system/agent` channels](../Flow/Nodes/Script/references/system/agent.md): where the branches' answers are collected.
- Which store carries what, and why: [references/communication.md](references/communication.md). The rules come from
  [references/building-blocks.md](references/building-blocks.md) (d), (f) and (g).

## The shape

```
Project.flow (the console agent listing-reviewer)
                      ClarityReview-Start ┐ Flow Pointers
                      PolicyReview-Start  ┼─▶ wait
                      TitleReview-Start   ┘     │
Start ─▶ Seed ─▶ Parallel Flows "Three reviews" ─▶ Collect reviews ─▶ Make votes ─▶ Parallel Context ─▶ Combine ─▶ LLM listing-reviewer ─▶ End
          │            │ each branch:                (consume the                     │ Voter-Start × 3
          │            ▼                              channel)                         ▼
          │      Start ─▶ Ask reviewer ─▶ LLM <reviewer> ─▶ End       Voter.flow: Start ─▶ LLM publish-voter ─▶ End
          │               (files the listing on               │                         (agentResponse → vote,
          │                channel listing-review)            └─ its answer lands on     merged into its element)
          │                                                      the same channel
          └─ the listing → session "listing" + dictionary.listing

LLM listing-reviewer: Fallback ─▶ the same LLM on gemini-2.5-flash (same Out and Summary; its Fallback ─▶ End)
                      Summary ─▶ Summarizer (claude-haiku-4-5) ─Fallback─▶ Summarizer (gpt-4o-mini); both Outs ─▶ End  (both LLMs)
```

## How the data moves

The three means (session, channels, private dictionaries) are defined in
[references/communication.md](references/communication.md). Here is what each step uses:

1. **Seed** reads the person's message (`getRootAgentPrompt('listing-reviewer')`). It writes the listing to the
   **session** (`listing`), because that is the one store a Parallel Flows branch can read: each branch starts with an
   empty dictionary. It also writes the listing to the main **dictionary** for the vote list.
2. **Parallel Flows** starts the three branches at once, each with an empty dictionary of its own and the run's
   session.
3. In each branch, **Ask reviewer** reads `listing` from the session. It files it as the reviewer's trigger with
   `setRootAgentPrompt(<reviewer>, { …, channel: 'listing-review' })`, on the branch's own session.
4. **The reviewer** (its own `agentId`, Interact with DB off, Use tools off) answers that prompt. The engine writes the
   answer to the **same channel** as the trigger, even with Interact with DB off. Then the branch ends and its
   dictionary is deleted, but the answer is not lost: it is on the **channel**.
5. **Collect reviews** runs after the last branch has finished. `consumeChannelResponses('listing-review')` reads all
   three answers and deletes them in one step, and `deleteChannel` removes the three trigger prompts. The Script
   writes **one text**, `dictionary.reviews`, because a prompt cannot read a list.
6. **Make votes** writes `dictionary.votes`: three identical elements, with the listing inside each one. An LLM inside
   a Parallel Context run reads `${session.…}` as **empty**.
7. **Parallel Context** gives each run a copy of its element as its whole **dictionary**. `publish-voter` reads
   `${dictionary.listing}` from an authored `user` turn, and `agentResponse` writes `vote`. At End Flow, the run's
   dictionary is **merged** back into its element.
8. **Combine** counts the votes (a tie is `hold`). It builds `dictionary.report` from the reviews and the count, then
   deletes the list. **listing-reviewer** (the console agent's ID, Interact with DB on) answers the seller from
   `${dictionary.report}`, and its answer is the chat's saved answer.

**Collecting Parallel Flows results: a channel or the session?**

| | Channel (this example) | Session keys |
|---|---|---|
| Who writes the result | the branch's LLM, by itself: a trigger on the channel puts the answer on the channel | a Script after the branch's LLM, one key per branch |
| Values | text entries of up to 8 MB, with their `agentID` | strings, numbers, booleans and `null`, 1.5 MB for the whole run |
| Collecting | one `consumeChannelResponses` returns every entry and deletes the lane | read each key by name |
| Clean-up | done by the consume (and `deleteChannel`) | the keys stay until the run ends, unless you overwrite them |

Use a **channel** for LLM results. Use **session keys** only for a few small values, such as a number or a flag per
branch. The branches' *input* is a small run-wide fact, so it goes in the session.

## What the person sees

Every LLM node's text streams to the person's chat while it is written — by design: the client gets each node's answer and its token use; the site shows everything behind the main agent in one accordion and waits for ONE final answer, the answering node's
([building-blocks.md](references/building-blocks.md) (f)).

- The three reviewers, then the three voters, are steps in the accordion. They write **at the same time**, so their
  live text arrives mixed, but each node's whole answer comes back to the client in its own result. Then the
  answering node writes the real review — the final answer.
- After a reload, the chat shows only the seller's message and the answering node's review. The reviewers and voters
  have Interact with DB off, so they save nothing.
- Keep the steps cheap: give each branch LLM a small `maxTokens` and a short output ("at most 5 bullet points",
  "the title only", one word per voter) — every branch's tokens count in the
  round's cost.

## Limits, cost and risks

- **Model calls per request:** 3 reviewers + 3 voters + 1 answer = 7. Each extra branch or vote adds one call.
- **How many at once:** Parallel Flows starts every branch at once, with no cap. Parallel Context runs in waves of
  **15** in the reference client: 3 votes are one wave, and 16 would be two.
- **A failing branch or vote.** A failed call still stores the provider's error text as the reviewer's answer, on
  the trigger's channel. So the reviewer's Fallback goes to `Drop failed answer`, which deletes that entry
  (`deleteAgentResponse(<reviewer>, { channel, sessionID })`), and `Collect reviews` then shows `(no answer)`. A voter that fails merges no `vote`, and that run counts
  as "without an answer". `Ask reviewer` throws when the session holds no listing, and its `error` ends that branch.
  A **final** error in any branch or run ends the **whole** run, for the others too (for example E8101, a Script's
  15-minute limit).
- **Sizes.** The listing is cut to 6000 characters. It is copied into each vote element, and the merged list counts
  toward the dictionary's 1.5 MB cap (a merge over it stops the run with **E2201**). `Combine` deletes the list. Keep
  the channel's entries small: `consumeChannelResponses` deletes the lane **before** the 10 MB read limit is checked,
  so an answer list over 10 MB is lost.
- **Triggers, channels and sessions.** An LLM node takes as its trigger the newest prompt filed under its `agentId`
  on **any** channel, and it prefers one on its own session. A channel therefore does **not** keep triggers apart; the
  session does. Each branch here has its own reviewer ID and files on its own session. Voters share one ID and file
  no prompt at all (their input is the authored `user` turn). Never mix the two inside one Parallel Context: a run
  that files nothing falls back to a sibling's prompt.
- **Cost.** Every call is billed. The voters use a small model with `maxTokens` 20. Interact with DB off sends no
  history, so each branch's cost is just its prompt and the listing.

## The complete example

Tradepost, a fictional second-hand marketplace. A seller pastes a listing. Three reviewers check it at once: missing
details, the marketplace's rules, and a better title. Three voters decide `publish` or `hold`. The agent answers with
one short review.

Files ([examples/parallelization/project](examples/parallelization/project), `keen-validate`: 0 errors, 0 warnings):

```
src/keen-tools.json                 { "tools": [] }
src/flows/Project.flow              the console agent listing-reviewer (Start Flow "Project", Start Node "Start")
src/flows/ClarityReview.flow        branch: clarity-reviewer (Claude Haiku)
src/flows/PolicyReview.flow         branch: policy-reviewer (GPT-5.4 mini)
src/flows/TitleReview.flow          branch: title-writer (GPT-5.4 nano)
src/flows/Voter.flow                one vote: publish-voter
src/scripts/review/{settings,seed,askReviewer,dropFailed,collectReviews,makeVotes,combine}.js
```

**The input** (`review/seed.js`). `review/settings.js` holds the channel name `listing-review` and `REVIEWERS`, a
map from each reviewer's `agentId` to its heading in the report:

```js
import Agent from 'system/agent';
import Session from 'system/session';

const MAX_CHARS = 6000;

// The listing the seller sent. Into the SESSION for the Parallel Flows branches (each branch starts
// with an empty dictionary), and into the DICTIONARY for the vote list (an LLM inside a Parallel
// Context run reads ${session.…} as empty, so the listing travels inside each element).
export const exec = () => {
    const listing = String(Agent.getRootAgentPrompt('listing-reviewer')?.prompt ?? '').trim().slice(0, MAX_CHARS);
    Session.setSessionValue('listing', listing);
    dictionary.listing = listing;
    dictionary.reviews = '';
    dictionary.report = '';
    return { ok: true };
};
```

**The Parallel Flows wiring**: the node, its three Flow Pointers and their edges into `wait`:

```json
{"id": "parallelInNode_aFCOT0OTEzkj", "type": "parallelInNode", "position": {"x": 304, "y": 944},
 "data": {"label": "Three reviews", "description": "Sectioning: three different reviewer flows at once", "labelNode": "Parallel Flows", "descriptionNode": "Execute many flows in parallel with private context", "open": false,
  "settings": {}},
 "dragHandle": ".drag-handle__custom"},
{"id": "parallelFlowNode_yVsXychuwQ5O", "type": "parallelFlowNode", "position": {"x": 800, "y": 752},
 "data": {"label": "ClarityReview-Start", "description": "", "labelNode": "Flow Pointer", "descriptionNode": "Point to the flow that must be awaited", "open": false,
  "settings": {"value": "ClarityReview-Start", "label": "ClarityReview-Start"}},
 "dragHandle": ".drag-handle__custom"},
{"id": "parallelFlowNode_xe58I1Rxymzu", "type": "parallelFlowNode", "position": {"x": 800, "y": 944},
 "data": {"label": "PolicyReview-Start", "description": "", "labelNode": "Flow Pointer", "descriptionNode": "Point to the flow that must be awaited", "open": false,
  "settings": {"value": "PolicyReview-Start", "label": "PolicyReview-Start"}},
 "dragHandle": ".drag-handle__custom"},
{"id": "parallelFlowNode_fOkP4CMaAdRo", "type": "parallelFlowNode", "position": {"x": 800, "y": 1136},
 "data": {"label": "TitleReview-Start", "description": "", "labelNode": "Flow Pointer", "descriptionNode": "Point to the flow that must be awaited", "open": false,
  "settings": {"value": "TitleReview-Start", "label": "TitleReview-Start"}},
 "dragHandle": ".drag-handle__custom"}
```

```json
{"id": "xy-edge__parallelFlowNode_yVsXychuwQ5Onext-parallelInNode_aFCOT0OTEzkjwait", "type": "step", "source": "parallelFlowNode_yVsXychuwQ5O", "sourceHandle": "next", "target": "parallelInNode_aFCOT0OTEzkj", "targetHandle": "wait"},
{"id": "xy-edge__parallelFlowNode_xe58I1Rxymzunext-parallelInNode_aFCOT0OTEzkjwait", "type": "step", "source": "parallelFlowNode_xe58I1Rxymzu", "sourceHandle": "next", "target": "parallelInNode_aFCOT0OTEzkj", "targetHandle": "wait"},
{"id": "xy-edge__parallelFlowNode_fOkP4CMaAdRonext-parallelInNode_aFCOT0OTEzkjwait", "type": "step", "source": "parallelFlowNode_fOkP4CMaAdRo", "sourceHandle": "next", "target": "parallelInNode_aFCOT0OTEzkj", "targetHandle": "wait"}
```

**One branch** (`ClarityReview.flow`: Start → `Ask reviewer` with the Key/Value Pair `reviewer` =
`clarity-reviewer` → the LLM → End). The Script's `error` goes to End, and the LLM's Fallback goes to `Drop failed answer`
(`review/dropFailed.js`) → End. The other two branches differ only in the pairs and the LLM node:

```json
  "settings": {
   "agentId": "clarity-reviewer", "agentName": "Clarity Reviewer", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-haiku-4-5-20251001", "modelId": 4939, "parameters": {"temperature": 0.2, "maxTokens": 600}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You review listings for Tradepost, a fictional second-hand marketplace. The user message is a listing. List what a buyer would miss (condition, size, age, what is included, pick-up or delivery): at most 5 short bullet points, or \"Nothing missing.\"."}
   ],
   "specialRules": [{"type": "skip-internal-database-interactions"}, {"type": "skip-internal-tooling"}]
  }
```

```js
import Agent from 'system/agent';
import Session from 'system/session';
import Tools from 'system/tools';
import { REVIEW_CHANNEL } from './settings.js';

// First node of every review branch. Key/Value Pair: reviewer (the agentId of the branch's LLM).
// The prompt is filed on the review channel, so the reviewer's answer lands on the SAME channel,
// where the Script after Parallel Flows collects all three.
export const exec = (props) => {
    const listing = String(Session.getSessionValue('listing') ?? '');
    if (!listing) throw new Error('no listing in the session');
    Agent.setRootAgentPrompt(String(props.reviewer), {
        prompt: listing,
        sessionID: flowContext.sessionId,                      // the branch's session = its LLM node's session
        requestID: Tools.generateUUID(),
        channel: REVIEW_CHANNEL
    });
    return { ok: true };
};
```

**The result-collecting Script after Out:**

```js
import Agent from 'system/agent';
import { REVIEW_CHANNEL, REVIEWERS } from './settings.js';

// After Parallel Flows every branch has finished. Read AND delete the reviewers' answers on the
// channel, then delete the channel's trigger prompts too. A prompt cannot read a list: build ONE text.
export const exec = () => {
    const answers = Agent.consumeChannelResponses(REVIEW_CHANNEL);   // newest first
    Agent.deleteChannel(REVIEW_CHANNEL);
    dictionary.reviews = Object.entries(REVIEWERS)
        .map(([agentId, heading]) => {
            const answer = answers.find(a => a.agentID === agentId);
            return `${heading}:\n${String(answer?.response ?? '').trim() || '(no answer)'}`;
        })
        .join('\n\n');
    return { ok: true };
};
```

**Voting with Parallel Context.** `review/makeVotes.js` writes `dictionary.votes` as three elements
`{ n, listing }`. Then come the node and the voter:

```json
{"id": "parallelContextNode_cp30FwcDmaqr", "type": "parallelContextNode", "position": {"x": 304, "y": 2240},
 "data": {"label": "", "description": "Voting: the same flow three times, each vote merged into its element", "labelNode": "Parallel Context", "descriptionNode": "Point to the single flow that must be awaited with predefined context", "open": false,
  "settings": {"pipe": "Voter-Start", "contextCollection": "dictionary.votes", "assignTo": "votes"}},
 "dragHandle": ".drag-handle__custom"}
```

```json
  "settings": {
   "agentId": "publish-voter", "agentName": "Publish Voter", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-haiku-4-5-20251001", "modelId": 4939, "parameters": {"temperature": 0.8, "maxTokens": 20}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "Decide whether this listing can be published on Tradepost, a fictional second-hand marketplace, as it is. Tradepost's rules (fictional): no weapons, no medicines, no live animals; no phone numbers, e-mail addresses or links in the text; the price is stated in EUR. It must also give a buyer enough detail to decide. Answer with exactly one word: publish or hold."},
    {"id": "p1", "role": "user", "content": "${dictionary.listing}"}
   ],
   "specialRules": [{"type": "skip-internal-database-interactions"}, {"type": "skip-internal-tooling"}],
   "agentResponse": true, "agentResponseProperty": "vote"
  }
```

**Combining everything:**

```js
// After Parallel Context every element carries its run's `vote` (the merge). Count the votes,
// combine them with the reviews into ONE text for the answering node, drop the list.
export const exec = () => {
    const votes = (Array.isArray(dictionary.votes) ? dictionary.votes : []).map(v => String(v.vote ?? '').trim().toLowerCase());
    const publish = votes.filter(v => v.startsWith('publish')).length;
    const hold = votes.filter(v => v.startsWith('hold')).length;
    dictionary.verdict = publish > hold ? 'publish' : 'hold';     // a tie or no votes: hold
    dictionary.report = `${dictionary.reviews || '(the reviews did not run)'}\n\n` +
        `Vote: ${publish} publish, ${hold} hold, ${votes.length - publish - hold} without an answer. Verdict: ${dictionary.verdict}.`;
    delete dictionary.votes;
    return { ok: true };
};
```

The answering node `listing-reviewer` (Claude Sonnet, Interact with DB on, Use tools off) has one system prompt
ending in `Report:\n${dictionary.report}`.

**To adapt it:** for another section, copy a review flow under a new name and new node ids, give its LLM a new
`agentId`, add a Flow Pointer and its `wait` edge, and add the ID and its heading to `REVIEWERS`. For more votes, raise
`VOTERS`. Change the voters' rule in their prompt and the count in `combine.js`. Then run `keen-validate` →
`keen-deploy` → a test chat, and read each branch's answer in the flow tree.

## Variations

1. **Sectioning only, or voting only.** Drop one half. Sectioning alone: Collect reviews → the answering node.
   Voting alone: Seed → Make votes → Parallel Context → Combine.
2. **Sectioning with Parallel Context and a `kind`.** When the sections differ only in their prompt, make one element
   per section (`{ kind, listing }`). Let one flow pick the prompt with Conditions on `kind`. The results then merge
   back by themselves, with no channel and no branch flows. This is how way B of
   [orchestrator-worker.md](orchestrator-worker.md) runs its specialists.
3. **Voting across models.** For independent opinions, put one voter flow per model behind Parallel Flows (each with
   its own `agentId`) and collect the votes on a channel, as the reviews are collected here.
4. **A judge instead of a count.** When the results are free text that cannot be counted, give them (as one text) to
   a judge LLM that picks or merges. That costs one more call, and the judge's text streams too.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a branch writes its result to `dictionary.x`, and the main flow reads it after Out | empty: the branch's dictionary is deleted | a channel (or a session key) |
| a branch LLM reads `${dictionary.listing}` set before Parallel Flows | empty: a branch starts with an empty dictionary | the session, or a Script that files the input as its trigger |
| a voter reads `${session.listing}` inside Parallel Context | empty text | put the value in the element |
| `dictionary.votes = ['publish?', …]` (strings) | every element becomes `{}`, and the runs get nothing | a list of objects |
| two branches write the same session key | the last one wins, and the others are lost | one channel, or one key per branch |
| `getChannelResponses` and never deleting the lane | a later collector in the same run reads the old entries too | `consumeChannelResponses`, then `deleteChannel` |
| a branch's Fallback goes straight to End | the provider's error text is collected as if it were a review | delete the failed entry on the Fallback path |
| two Scripts consume one channel | the second one gets `[]` | one consumer per channel |
| one channel per run, expecting it to keep triggers apart | it does not: triggers are matched across all channels | file each trigger on the run's own session, or give each run its own ID |
| voters with Interact with DB on, sharing one ID | runs see each other's turns of the current message | Interact with DB off |
| a Condition on `${dictionary.votes}` | the run stops: a list cannot be tested | a Script counts and stores a word or a number |
| Parallel Context inside a Parallel Flows branch | its runs seed from and merge into the main dictionary's list at that path, not the branch's — usually none: they start from `{}`, and nothing merges | keep it on the main path |
| two paths into the Parallel Flows `in` | each arrival starts every branch again | let only one path reach it |
| `"settings": { "value": "results" }` on Parallel Flows, or reading `assignTo` | nothing is written there | a channel; the list itself |
