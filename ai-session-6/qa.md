Q1. Tool call ordering
In an earlier exercise, you gave the model two tools – getOrderStatus and
searchKnowledgeBase – and for a particular user message, the model chose to call
getOrderStatus first, even though nothing in your code specified an order. Why that ordering?
Walk through what’s actually sitting in the model’s context at generation time that produces this
specific sequence – “the model decided” is not an answer, the mechanism behind the decision is.

Ans - 
This can possibly happened due to narrow gap in probability distribution ( PD ) of tools. The PD can be influenced by description, inputSchema of tools and the system prompt given. The wider the gap, higher PD and less ambiguity to decide which tools to call.


Q2. Vague descriptions, at the token level
Section 3 argued that a tool’s description is the only signal the model has for deciding whether
to call it. Suppose searchKnowledgeBase ’s description just said “Searches for information” – no positive examples, no negative examples. Explain, in terms of next-token probabilities rather than “the model gets confused,” exactly how that vagueness produces a wrong tool call in production.
What specifically is missing that a sharper description would have supplied?

Ans  - This vagauness directly influences the probability distribution of tools. It is possible that it is more skewed towards a different tool if the prompts or tool descriptins are vague. Adding negative examples, helps model to decide what not to call. 



Q3. Step limits without a built-in flag
LangGraph.js doesn’t hand you a maxSteps config the way some SDKs do. Using what you know
about shouldContinue and shared graph state, design a concrete mechanism that stops an agent
after, say, 5 tool calls, even if the model wants to keep going. Where does the counter live, and
what exactly does shouldContinue do differently once that counter is exceeded?


Ans - not sure how to answer


Q4. MemorySaver in production
Your local dev agent uses MemorySaver and passes every test you throw at it. You deploy to
Railway, and three days later a support ticket comes in: a user approved a pending action and
nothing happened. Trace what actually went wrong, step by step – from the approval click to the
silent failure – and explain why swapping to PostgresSaver fixes it without requiring you to rewrite
the graph itself.

Ans - not sure how to answer


Q5. Design exercise – an email-reading agent
Your product wants a feature that reads incoming support emails, drafts a reply, and sends it. First,
decide: is this an agent or a pipeline? Justify the call using the test from Section 7 – not a gut
feeling. Then list the tools it would need, and identify specifically which action(s) you’d gate behind
human-in-the-loop and which you wouldn’t, and why that split.

Ans - not sure how to answer
