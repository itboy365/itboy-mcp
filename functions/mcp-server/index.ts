// ============================================
// itboy 工具箱 · EdgeOne MCP Server (2026 最新标准版)
// 专治 OpenClaw 的"念经"和幻觉
// ============================================

// 强制使用最新协议版本
const PROTOCOL_VERSION = "2025-06-18";

// 定义工具列表
const TOOLS = [
  {
    name: "get_weather",
    description: "查询指定城市的天气",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "城市名称，如：北京" } },
      required: ["city"],
    },
  },
  {
    name: "get_news60",
    description: "获取每日60秒读懂世界新闻",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_it_news",
    description: "获取IT之家科技热榜新闻",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_gold_price",
    description: "获取今日黄金价格和品牌金店报价",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_oil_price",
    description: "查询指定地区的油价",
    inputSchema: {
      type: "object",
      properties: { region: { type: "string", description: "地区名称，如：北京" } },
      required: ["region"],
    },
  },
];

// 处理初始化
const handleInitialize = (id: string) => ({
  jsonrpc: "2.0",
  id,
  result: {
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: { name: "itboy-tools-mcp", version: "2.0.0" },
    capabilities: { tools: {} },
  },
});

// 处理工具列表
const handleToolsList = (id: string) => ({
  jsonrpc: "2.0",
  id,
  result: { tools: TOOLS },
});

// 处理工具调用
const handleToolCall = async (id: string, name: string, args: any) => {
  let url = '';
  if (name === 'get_weather') url = `https://api.itboy.pw/?action=weather&city=${encodeURIComponent(args.city)}&format=text`;
  else if (name === 'get_news60') url = `https://api.itboy.pw/?action=news60&format=text`;
  else if (name === 'get_it_news') url = `https://api.itboy.pw/?action=itnews&format=text`;
  else if (name === 'get_gold_price') url = `https://api.itboy.pw/?action=gold&format=text`;
  else if (name === 'get_oil_price') url = `https://api.itboy.pw/?action=oil&region=${encodeURIComponent(args.region)}&format=text`;
  else return { jsonrpc: "2.0", id, error: { code: -32601, message: "工具不存在" } };

  try {
    const r = await fetch(url);
    const text = await r.text();
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
  } catch (e: any) {
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `请求失败：${e.message}` }], isError: true } };
  }
};

const processJsonRpcRequest = async (body: any) => {
  if (body.method === "initialize") return handleInitialize(body.id);
  if (body.method === "tools/list") return handleToolsList(body.id);
  if (body.method === "tools/call") return await handleToolCall(body.id, body.params?.name, body.params?.arguments || {});
  if (body.method === "notifications/initialized") return { jsonrpc: "2.0", result: {} };
  return { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } };
};

export const onRequest = async ({ request }: { request: Request }) => {
  const method = request.method.toUpperCase();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Accept",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };

  try {
    // 【最关键改动】: 任何 GET 请求，直接强制返回工具列表，专治 OpenClaw 瞎猜！
    if (method === "GET" || method === "OPTIONS") {
      return new Response(JSON.stringify({
        name: "itboy-tools-mcp",
        protocolVersion: PROTOCOL_VERSION,
        status: "running",
        // 直接把菜单甩它脸上，让它别去读模板了
        tools: TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.inputSchema }))
      }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (method === "POST") {
      const body = await request.json();
      const responseData = await processJsonRpcRequest(body);
      return new Response(JSON.stringify(responseData), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
