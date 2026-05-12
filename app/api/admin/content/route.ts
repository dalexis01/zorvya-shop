import { NextResponse } from "next/server";

import {
  createProductAiDraft,
  getAllProductAiDrafts,
  getProductAiDraftById,
  updateProductAiDraft,
} from "@/lib/server/admin/ai-drafts";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("id");

    if (draftId) {
      const draft = await getProductAiDraftById(draftId);

      return NextResponse.json({
        success: Boolean(draft),
        draft,
      });
    }

    const drafts = await getAllProductAiDrafts();

    return NextResponse.json({
      success: true,
      drafts,
    });
  } catch (error) {
    console.error("Failed to get content drafts:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get content drafts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const payload = await request.json();
    const draft = await createProductAiDraft({
      sourceImageUrl: String(payload.sourceImageUrl ?? ""),
      nameHint: typeof payload.nameHint === "string" ? payload.nameHint : undefined,
      brandHint: typeof payload.brandHint === "string" ? payload.brandHint : undefined,
      categoryHint: typeof payload.categoryHint === "string" ? payload.categoryHint : undefined,
    });

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error("Failed to create content draft:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create content draft",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const payload = await request.json();
    const draft = await updateProductAiDraft(String(payload.id ?? ""), {
      approvedName: typeof payload.approvedName === "string" ? payload.approvedName : undefined,
      approvedShortDescription:
        typeof payload.approvedShortDescription === "string"
          ? payload.approvedShortDescription
          : undefined,
      approvedLongDescription:
        typeof payload.approvedLongDescription === "string"
          ? payload.approvedLongDescription
          : undefined,
      approvedCategory:
        typeof payload.approvedCategory === "string" ? payload.approvedCategory : undefined,
      approvedTags: Array.isArray(payload.approvedTags)
        ? payload.approvedTags.map((tag: unknown) => String(tag))
        : undefined,
      approvedImageIds: Array.isArray(payload.approvedImageIds)
        ? payload.approvedImageIds.map((id: unknown) => String(id))
        : undefined,
    });

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error("Failed to update content draft:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update content draft",
      },
      { status: 500 }
    );
  }
}
