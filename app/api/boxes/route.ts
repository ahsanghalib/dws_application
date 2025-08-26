import { createClient } from "@/utils/supabase";
import { type NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseClient = await createClient();
    const { data } = await supabaseClient
      .from("alliance_layout")
      .select("*")
      .order("id", { ascending: false }) // Order by ID in descending order
      .limit(1); // Get only the first (last added) row;

    if (data && data?.length > 0) {
      const { data: record } = data[0];
      return NextResponse.json({
        success: true,
        data: record,
        source: "supabase",
      });
    }

    // Return empty data if nothing found
    return NextResponse.json({
      success: true,
      data: { boxes: [], zoom: 1, theme: false },
      source: "default",
    });
  } catch (error) {
    console.error("Failed to read from Edge Config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read data",
        source: "error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const { boxes, zoom, theme, panning } = await request.json();

    // Prepare data for Edge Config
    const data = {
      boxes,
      zoom,
      theme,
      panning,
    };

    const { data: newData, error } = await supabaseClient
      .from("alliance_layout")
      .insert([{ data }])
      .select();

    console.log(newData, error);

    if (error) {
      throw new Error(`error: ${error}`);
    }

    return NextResponse.json({
      success: true,
      message: "Data saved",
    });
  } catch (error) {
    console.error("Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save data",
      },
      { status: 500 },
    );
  }
}
