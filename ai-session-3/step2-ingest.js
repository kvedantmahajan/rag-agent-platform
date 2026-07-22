import { pipeline } from "@xenova/transformers";
import pg from "pg";
import * as dotenv from "dotenv";
dotenv.config();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

await db.connect();
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
async function embed(text) {
    const out = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
}
const articles = [{
    title: "How to reset your password",
    content: "To reset your password, click Forgot Password on the login page. "
        + "Enter your email and we will send a reset link. "
        + "The link expires after 24 hours."
},
{
    title: "Requesting a refund",
    content: "Refunds are processed within 5 to 7 business days. "
        + "Go to Order History, select the order, click Request Refund. "
        + "Only available within 30 days of purchase."
},
{
    title: "Cancelling your subscription",
    content: "Cancel at any time from Account Settings. "
        + "Access continues until end of current billing period."
},
{
    title: "Tracking your order",
    content: "You receive a tracking email within 24 hours of shipping. "
        + "Click the link to see real-time delivery status."
},
{
    title: "Updating your billing information",
    content: "Go to Account Settings, select Billing, click Update Payment Method. "
        + "We accept Visa, Mastercard, and UPI."
},
{
    title: "Two-factor authentication setup",
    content: "Go to Account Settings, select Security, click Enable 2FA. "
        + "Scan the QR code with Google Authenticator or Authy."
},
];
await db.query("DELETE FROM kb_articles");
for (const article of articles) {
    // Embed title + content together for richer semantic signal
    const vector = await embed(`${article.title}. ${article.content}`);
    const vectorStr = `[${vector.join(",")}]`;
    await db.query(
        "INSERT INTO kb_articles (title, content, embedding) VALUES ($1, $2, $3)",
        [article.title, article.content, vectorStr]
    );
    console.log(`Stored: "${article.title}"`);
}
await db.end();