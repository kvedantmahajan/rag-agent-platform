// Fixed-size chunker with overlap
function chunkText(text, chunkSize = 300, overlapTokens = 50) {
    const words = text.split(/\s+/);
    const chunks = [];
    let start = 0;
    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        chunks.push(words.slice(start, end).join(" "));
        start += chunkSize - overlapTokens;
        if (start >= words.length) break;
    }
    return chunks;
}

// Sentence-boundary chunker
function chunkBySentence(text, maxSentences = 3, overlapSentences = 1) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let i = 0;
    while (i < sentences.length) {
        chunks.push(sentences.slice(i, i + maxSentences).join(" "));
        i += maxSentences - overlapSentences;
        if (i >= sentences.length) break;
    }
    return chunks;
}

async function chunkSemantically(text, threshold = 0.75) {
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return sentences;
    // Embed every sentence -- the expensive step
    const embeddings = await Promise.all(sentences.map(embed));
    const chunks = [];
    let currentChunk = [sentences[0]];
    for (let i = 1; i < sentences.length; i++) {
        const similarity = cosineSim(embeddings[i - 1], embeddings[i]);
        if (similarity < threshold) {
            // Topic shift -- save chunk and start new one
            chunks.push(currentChunk.join(" "));
            currentChunk = [sentences[i]];
        } else {
            currentChunk.push(sentences[i]);
        }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
    return chunks;
}

async function embedBatch(texts, batchSize = 32) {
    const results = [];
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(embed));
        results.push(...batchResults);
    }
    return results;
}


async function retrieveMMR(query, topK = 5, lambda = 0.5, candidateK = 20) {
    // Step 1: retrieve more candidates than needed (3-5x topK)
    const vec = await embed(query);
    const vecStr = `[${vec.join(",")}]`;
    const result = await db.query(
        `SELECT title, content,
    embedding::text AS embedding_raw,
    1-(embedding<=>$1::vector) AS similarity
    FROM kb_articles
    ORDER BY embedding<=>$1::vector
    LIMIT $2`,
        [vecStr, candidateK]
    );
    const candidates = result.rows.map(r => ({
        title: r.title, content: r.content,
        similarity: parseFloat(r.similarity),
        embedding: JSON.parse(r.embedding_raw),
    }));
    // Step 2: iteratively select using MMR scoring
    const selected = [];
    const remaining = [...candidates];
    while (selected.length < topK && remaining.length > 0) {
        let bestScore = -Infinity, bestIdx = 0;
        remaining.forEach((candidate, idx) => {
            const relevance = candidate.similarity;
            const redundancy = selected.length === 0
                ? 0
                : Math.max(...selected.map(s =>
                    cosineSim(candidate.embedding, s.embedding)));
            const mmrScore = lambda * relevance - (1 - lambda) * redundancy;
            if (mmrScore > bestScore) { bestScore = mmrScore; bestIdx = idx; }
        });
        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
    }
    return selected.map(({ title, content, similarity }) =>
        ({ title, content, similarity })
    );
}