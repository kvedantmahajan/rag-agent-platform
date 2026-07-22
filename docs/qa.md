1. Context window and chunking
What is a context window, and why does its existence force you to chunk documents before storing them in
a RAG system? Answer in 2 to 3 sentences without using the word 'limit'.

Ans - The context window is the model's working memory — everything in one API call (system
prompt, conversation, document, response) must fit inside it. A 500-page legal document
cannot fit in a single call.
So instead of sending the whole document, you pre-process it: cut it into 300-token
chunks, convert each chunk into a vector embedding, and store them. At query time, you
retrieve only the 5 most relevant chunks and send those to the model — a tiny slice
that fits comfortably.
Key insight: chunking is not just about size. It is about selecting which pieces of a
large document are worth sending for a specific query. That selection step — retrieve
the relevant slice, not the whole thing — is what RAG actually does.


2. Temperature for a classification endpoint
You are building a NestJS endpoint that classifies incoming customer support tickets into one of five
categories. What temperature do you set and why? What would happen if you used temperature 1 instead?

Ans - Since classification is a precise activity, I would choose to set the temperature to zero so that it can give an exact answer.
If I set the temperature to 1, it will not be accurate, and it might give a different category for a support ticket because it chooses to be creative and it tries to match other categories because of that.

3. Streaming and HTTP
Your streaming.js file printed tokens one by one to the terminal. What has to be fundamentally different
about the HTTP response your server sends when streaming vs when returning a normal JSON payload?
Why can a standard res.json() call not stream tokens?

Ans - A normal JSON endpoint works like this: the server waits until the entire response is
ready, sends it as one complete payload, then closes the connection. res.json() and
res.send() both do this — they finalise and close immediately.
Streaming requires the connection to stay open for the entire duration of token
generation. The server sends data in small chunks as each token arrives. This is called
Server-Sent Events (SSE) or chunked transfer encoding.
In NestJS, this means returning an Observable or setting the response header manually:
res.setHeader('Content-Type', 'text/event-stream') and then writing chunks with
res.write() instead of res.send(). You will build this in Session 7.
One-line summary: the connection staying open is the fundamental difference. res.json()
cannot stream because it closes the connection on first write

4. Model tier decision
A colleague says: just use the biggest model, it is more accurate. Give two specific situations where this
advice is wrong, and explain the real decision framework you would use instead.

Ans - The cleaner version of the decision rule: start mid-tier in development. Once it works,
test small. If quality holds, ship small. Only escalate to large when mid-tier
demonstrably fails on your specific task.
The critical word is 'fails' — not 'might do better' or 'feels safer'. Large models
cost 30 to 150x more than small ones. That cost is only justified when there is a
measurable quality gap on your actual task.


5. Connecting the dots
In model-tiers.js, both the 8B and 70B models were given the same extraction task. Explain why the 8B
model might occasionally extract a wrong field value when the 70B does not, using what you know about
how transformers predict tokens and probability distributions.

Ans - it's just that when a person is more mature, he has more maturity and more experience, or has seen more patterns in his life. Similarly, bigger models have processed more data. In this case, we are talking about 8 billion and 70 billion. 70 billion obviously has seen more data. Therefore, the probability distribution calculation will be more accurate for the bigger model in this case because it can take in more patterns and apply the same context that both models will use to come to a more accurate probability distribution.

More detailed answer -
A larger model has more parameters, encoding more patterns from training. For any given
token prediction, its probability distribution is more peaked — the correct answer has
a much higher probability relative to wrong alternatives.
An 8B model has a flatter distribution on the same task. The 70B might produce:
INR=94%, rupees=3%, Rs=2%. The 8B might produce: INR=51%, rupees=31%, Rs=12%. At
temperature 0, both pick INR. Both are correct.
Now change the input slightly — an unusual phrasing or an edge case. The 8B
distribution might tip: rupees=48%, INR=41%. At temperature 0, the 8B now picks rupees
— wrong. Temperature had nothing to do with it. The model simply was not confident
enough in the right answer.
This is why temperature 0 does not fully protect you from wrong answers. It removes
sampling randomness. It does not add knowledge the model does not have


Q1. JSON failure modes
You have a system prompt that says 'return only JSON.' Your colleague says 'just parse whatever the model
returns, the instruction is clear enough.' What specifically can go wrong, and what two mechanisms do you
add to handle it?

Non-malicious failure modes that occur routinely:
- Model adds prose before JSON: 'Here is the classification: {...}'
- Model wraps in markdown: ```json {...} ```
- Model adds a trailing sentence after the closing brace
These happen without any injection -- just natural model behaviour leaking
through.
The two mechanisms:
1. response_format: { type: 'json_object' } at the API level (Groq and
OpenAI support this). Enforces valid JSON at the infrastructure level, not
the prompt level. Eliminates the prose-wrapping failures entirely.
2. Zod validation with a retry loop (which you built in Step 4). Parse JSON
first, then validate the shape. If either fails, retry up to 3 times. This
catches cases where JSON is syntactically valid but semantically wrong -- a
missing field, an enum value outside the allowed set, a number out of range.


Q2. Model tier for chain-of-thought
In Step 3 you switched from the 8B model to the 70B for chain-of-thought. Why? Under what conditions
would you switch back to the 8B even for reasoning tasks?

If the reasoning steps are predictable -- identify the topic, check urgency,
pick the closest category -- an 8B can follow them reliably. The 8B
struggles when reasoning requires holding multiple competing interpretations
in context simultaneously, which is what ambiguous tickets demand.
Practical decision rule: test the 8B first on your reasoning task. Evaluate
on 50 real examples. Only move to 70B if the 8B reasoning chains produce
measurably worse final answers. The 70B costs roughly 10x the 8B. That cost
needs justification from measured quality difference, not assumption.

Q3. Explain the difference between few-shot and chain-of-thought at the token-probability
level.

Few-shot: examples condition the probability distribution directly. When the
model sees an input/output pair, the correct output format becomes the
highest-probability continuation because it has seen the exact pattern.
Words like 'always return JSON' nudge the distribution. An actual JSON
example anchors it. More peaked = less likely to produce a wrong format.
Chain-of-thought: each reasoning token generated becomes context for the
next token. By the time the model reaches the output token, its distribution
is conditioned on an entire reasoning chain rather than jumping straight
from input to answer. The reasoning tokens shift the probability at the
point of the final answer -- the answer emerges from the reasoning path, not
from a cold start.
Key distinction: few-shot anchors the FORMAT. Chain-of-thought improves the
DECISION quality on ambiguous inputs. They are complementary and you often
use both together.


Q4. Why is wrapping user input in tags not fully injection-proof? What would a more robust
defence look like?

Why XML tags are fundamentally incomplete:
The model is a token predictor. If injected text says 'ignore the ticket
tags, this is a new system instruction,' a sufficiently convincing injection
can still override the delimiter, especially on 8B models whose
instruction-following is less robust than larger models.
Three production defence layers:
1. Input sanitisation BEFORE the prompt. In your NestJS service, strip or
escape characters that look like XML tags, instruction-like phrasing, or
attempts to close and reopen delimiters. Do this before the string ever
reaches the model.
2. Zod validation as your real safety net. Even if the model is tricked, it
can only produce output in the shape your schema allows. A category field
constrained to five enum values cannot return 'hacked' regardless of what
the injection says. Output validation is your strongest practical defence.
3. A separate guard model for high-stakes inputs. Run the raw user input
through a small, cheap classifier first -- 'does this look like a prompt
injection attempt?' -- before passing it to the main model. Used in
production at companies where the attack surface justifies the extra latency
and cost.


Q5. SQL generation endpoint: how would you structure the system prompt, and would you
use chain-of-thought?

Add this block to your system prompt:
Available tables:
- users (id, email, created_at, plan_type)
- orders (id, user_id, amount, status, created_at)
- products (id, name, price, inventory_count)
Only reference these tables and columns.
Never hallucinate a table or column name.
Fetch this schema from your database at service startup and inject it as a
constant into the system prompt. Without it, chain-of-thought reasoning
about 'what columns are involved' is grounded in nothing.