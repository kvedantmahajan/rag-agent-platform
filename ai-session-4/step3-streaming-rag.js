async function ragStream(question) {
    console.log(`\nQ: ${question}\nA: `);
    const chunks = await retrieve(question);
    if (chunks.length === 0) {
        console.log("No relevant documentation found."); return;
    }
    const prompt = buildPrompt(chunks, question);
    const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user }
        ],
        temperature: 0,
        max_tokens: 300,
        stream: true // FOCUS
    });
    let fullResponse = "";
    for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        process.stdout.write(token);
        fullResponse += token;
    }
    // Parse citations from completed response
    const match = fullResponse.match(/SOURCES:\s*([\[\d\],\s]+)/);
    if (match) {
        const indices = [...match[1].matchAll(/\[(\d+)\]/g)]
            .map(m => parseInt(m[1]) - 1)
            .filter(i => i >= 0 && i < chunks.length);
        console.log("\n\nSources:");
        indices.forEach(i => console.log(` - ${chunks[i].title}`));
    }
    console.log("\n" + "-".repeat(50));
}