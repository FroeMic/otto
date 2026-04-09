export async function GET(
  request: Request,
  context?: {
    params: Promise<Record<string, string>>
  },
) {
  const url = new URL(request.url)

  return Response.json({
    id: (await context?.params)?.id ?? null,
    search: url.searchParams.get("search"),
  })
}
