export async function GET(request: Request & { nextUrl?: URL }) {
  return Response.json({
    pathname: request.nextUrl?.pathname ?? null,
    returnTo: request.nextUrl?.searchParams.get("returnTo") ?? null,
  })
}
