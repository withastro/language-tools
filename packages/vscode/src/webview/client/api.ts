export async function makeAskRequest(question: string) {
  const res = await fetch("https://round-shape-acdb.pika.workers.dev/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || res.status >= 400) {
    const { code, description } = await res.json();
    const e = new Error(description);
    throw e;
  }
  const data = await res.json();
  if (data.code) {
    const { code, description } = data;
    const e = new Error(description);
    throw e;
  }
  const baseURLs = new Map();
  for (const source of data.sources) {
    const baseURL = source.url.split("#")[0];
    const arr = baseURLs.get(baseURL) || [];
    arr.push(source);
    baseURLs.set(baseURL, arr);
  }
  const sources = Array.from(baseURLs.values())
    .sort((a, b) => b.length - a.length)
    .flat();

  return { ...data, sources };
}
