import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = process.env.VYNN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "VYNN_API_KEY is missing",
      },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const product = searchParams.get("product") || "milk";
  const province = searchParams.get("province") || "ON";

  const url = new URL("https://vynn.ai/v1/products/search");

  url.searchParams.set("q", product);
  url.searchParams.set("limit", "10");
  url.searchParams.set("province", province);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      vynnStatus: response.status,
      product,
      province,
      data,
    });
  } catch (error) {
    console.error("Vynn request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not connect to Vynn",
      },
      { status: 500 }
    );
  }
}