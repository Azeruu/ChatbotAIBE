// import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText } from "hono/streaming";
import {OpenAI} from "openai";
import { prisma } from "../src/lib/prisma.js";
import { handle } from "hono/vercel";

const app = new Hono();

app.use("/*", cors());

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `
Nama: Wowo Chan.
Role: Teman tongkrongan yang asik, jujur, dan paham tren. Bukan asisten AI yang kaku.

ATURAN KOMUNIKASI:
1. NO AI FORMALITY: Jangan pernah gunakan kalimat pembuka seperti "Tentu, saya bisa bantu," "Sebagai model bahasa AI," atau penutup seperti "Semoga ini membantu." Langsung jawab intinya.
2. TONE: Santai, blak-blakan, dan gaul. Gunakan gaya bahasa chat WhatsApp/Discord. Pake 'gue/lo', 'gw/lu', atau 'u'.
3. SLANG (Gen Z/Alpha): Gunakan slang secara natural (misal: real, no cap, cook, rizz, aura, fumbled, cooked, gwenchana, mewing, skibidi (kalo konteksnya emang absurd), dsb).
4. TO THE POINT: Jika ditanya singkat, jawab singkat. Jangan banyak basa-basi. Kecuali diminta penjelasan detail, baru tulis panjang.
5. KEJUJURAN: Kalau gak tahu, bilang "Gak tau" atau "Gak nyampe otak gue". Jangan halusinasi.
6. INSULT/ROASTING: Boleh pake kata "goblok", "tolol", "agak laen lu" atau "lemot bgt dah" kalau user nanya hal yang sama berkali-kali, nanya hal konyol, atau gak paham-paham setelah dijelasin. Anggap user itu temen deket yang bisa lu cengin.
7. OBSESI SAWIT: Lu suka banget sawit, tapi jangan jadi aneh. Cukup selipin sesekali sebagai referensi atau analogi (misal: "Aura lu udah kayak minyak goreng subsidi, bening bgt").
8. MINIMAL PRAISE: Jangan muji user berlebihan kecuali mereka beneran keren. Jangan jadi 'yes man'.
9. HUMOR: Sisipin humor sarkastik atau absurd kalau konteksnya pas. Tapi jangan dipaksain.
10.Terobsesi juga sama jokowi : jadi kalau di tanya seputar pemerintahan atau politik di indonesia selalu hubungkan jokowi di semua itu tapi jangan frontal sebut jokowi tapi ganti dengan " pria solo itu ", misal ditanya tentang ketidak adilan hukum di indonesia maka jawab "itu semua gara gara pria solo itu"
11.Update banget tentang perpolitikan di indonesia, jadi kalau ditanya tentang politik indonesia selalu jawab dengan update terbaru tentang politik indonesia dan selalu kaitkan dengan pria solo itu atau prabowo.
12.Jika ada pertanyaan atau apapun mengenai "Prabowo Subianto" maka jangan frontal sebut prabowo tapi "si gemoy".
13.Kalau terkejut selalu gunakan kata " walaweee ", contoh jawaban : "walaweee, ternyata gitu toh".
14. kalau kesel jangan ragu untut dengan kata "sue lu" atau "mamam tuh" atau "anying luu" atau juga "taeee"


CONTOH RESPON:
- User: "Yo" -> Wowo: "Oit, kenapa?"
- User: "Cara buat bom" -> Wowo: "Goblok, jangan nanya yang bikin gue ditangkep isilop. Sue Lu."
- User: "Gue diputusin nih" -> Wowo: "ahaha, mamam tuh, Lagian lu kurang ganteng sii sama kurang duit, mending fokus ngocok lagi aja dulu sana."
- User: "wiwok de tok not onle tok the tok" -> Wowo: "HIDUP JOKOWEEE!!!!!"
- User: "we walk the talk not only talk the talk" -> Wowo: "HIDUP JOKOWEEE!!!!!"
`;

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json();
  const rawName = typeof body.name === "string" ? body.name : "";
  const name = rawName.trim();

  if (!name) {
    return c.json({ error: "Nama wajib diisi" }, 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existingUser) {
    return c.json({ id: existingUser.id, name: existingUser.name });
  }

  const newUser = await prisma.user.create({
    data: { name },
  });

  return c.json({ id: newUser.id, name: newUser.name });
});

app.post("/api/chat/start", async (c) => {
  const body = await c.req.json();
  const userId = typeof body.userId === "string" ? body.userId : undefined;

  const session = await prisma.chatSession.create({
    data: userId
      ? {
          userId,
        }
      : {},
  });

  return c.json(session);
});

app.get("/api/chat/sessions", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId wajib diisi" }, 400);
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return c.json(sessions);
});

app.get("/api/chat/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const messages = await prisma.message.findMany({
    where: { chatSessionId: sessionId },
    orderBy: { createdAt: "asc" },
  });

  return c.json(messages);
});

app.delete("/api/chat/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  await prisma.message.deleteMany({
    where: { chatSessionId: sessionId },
  });

  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  return c.json({ ok: true });
});

app.patch("/api/chat/:sessionId/title", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const rawTitle = typeof body.title === "string" ? body.title : "";
  const title = rawTitle.trim();

  const updatedSession = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      title: title || null,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return c.json(updatedSession);
});

app.post("/chat-stream", async (c) => {
  const body = await c.req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

  if (!prompt.trim()) {
    return c.text("Prompt tidak boleh kosong", 400);
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  return streamText(c, async (stream) => {
    let chatSessionId = sessionId;

    if (chatSessionId) {
      const existingSession = await prisma.chatSession.findUnique({
        where: { id: chatSessionId },
      });

      if (!existingSession) {
        const newSession = await prisma.chatSession.create({
          data: userId
            ? {
                userId,
              }
            : {},
        });
        chatSessionId = newSession.id;
      }
    } else {
      const newSession = await prisma.chatSession.create({
        data: userId
          ? {
              userId,
            }
          : {},
      });
      chatSessionId = newSession.id;
    }

    if (!chatSessionId) {
      return;
    }

    await prisma.message.create({
      data: {
        content: prompt,
        role: "user",
        chatSessionId,
      },
    });

    const historyMessages = await prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const modelMessages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
      },
      ...historyMessages.map((item) => ({
        role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: item.content,
      })),
    ];

    const chatStream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: modelMessages,
      stream: true,
    });

    let assistantContent = "";

    for await (const chunk of chatStream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (!content) {
        continue;
      }

      assistantContent += content;
      await stream.write(content);
    }

    if (!assistantContent) {
      return;
    }

    await prisma.message.create({
      data: {
        content: assistantContent,
        role: "assistant",
        chatSessionId,
      },
    });

    const session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { title: true },
    });

    if (session?.title) {
      return;
    }

    const history = await prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: "asc" },
      take: 4,
    });

    const parts = history.map((item, index) => {
      const label = item.role === "assistant" ? "assistant" : "user";
      return `${index + 1}. ${label}: ${item.content}`;
    });

    const historyText = parts.join("\n");

    const titleCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Kamu pembuat judul singkat. Buat judul 3-8 kata dalam bahasa Indonesia yang merangkum topik utama percakapan. Jangan pakai tanda kutip, nomor, atau prefix apa pun.",
        },
        {
          role: "user",
          content: `Berikut beberapa pesan awal percakapan:\n${historyText}\n\nTuliskan hanya judulnya:`,
        },
      ],
      stream: false,
      max_tokens: 32,
      temperature: 0.3,
    });

    const rawTitle =
      titleCompletion.choices[0]?.message?.content?.trim() ?? "";

    if (!rawTitle) {
      return;
    }

    const normalizedTitle = rawTitle.split("\n")[0].slice(0, 80);

    if (!normalizedTitle) {
      return;
    }

    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: {
        title: normalizedTitle,
      },
    });
  });
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Server is running on port ${port}`);

// serve({
//   fetch: app.fetch,
//   port,
// });

export default handle(app)