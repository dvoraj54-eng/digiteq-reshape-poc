package cz.digiteq.tips.rules

import cz.digiteq.tips.CategoryActivity
import cz.digiteq.tips.R
import org.junit.Test

class CategoryRulesTest : ScreenRulesTest(
    activityClass = CategoryActivity::class.java,
    rootId = R.id.category_root,
    contentId = "category_content",
    wideExport = "S2_Category_1840x960.flat.json",
    portraitExport = "S2_Category_1400x1400.flat.json",
    p0 = listOf(
        "category_back_button", "category_title", "category_tabs", "category_tip_list", "category_tip_preview",
    ),
    groupedControls = setOf("category_tabs"),
) {
    /** R3: every list row has one height (104 dp). */
    @Test
    fun allListRowsAre104dpHigh() = onScreen { c ->
        (1..11).mapNotNull { n ->
            val row = c.view("category_tip_row_$n") ?: return@mapNotNull "row $n is missing"
            if (c.dp(row.height).toInt() != 104) "category_tip_row_$n is ${c.dp(row.height).toInt()} dp high, expected 104" else null
        }
    }

    /** R1: side by side, the preview keeps at least 560 dp. */
    @Test
    fun previewKeepsAtLeast560dp() = onScreen { c ->
        val w = c.dp(c.view("category_tip_preview")!!.width)
        if (w < 559.5f) listOf("category_tip_preview is ${w.toInt()} dp wide, minimum 560") else emptyList()
    }

    /** R7: list and preview end on one line; in portrait that line is the last whole row. */
    @Test
    fun listAndPreviewEndOnOneLine() {
        val portrait = isPortrait()
        onScreen { c ->
            val list = c.window(c.view("category_tip_list")!!)
            val preview = c.window(c.view("category_tip_preview")!!)
            val out = mutableListOf<String>()
            if (kotlin.math.abs(list.bottom - preview.bottom) > 1)
                out += "list ends at ${list.bottom}, preview at ${preview.bottom}"
            if (portrait) {
                val h = c.dp(list.height())
                if ((h + 16) % 120 > 0.5f && (h + 16) % 120 < 119.5f)
                    out += "list is ${h.toInt()} dp high: not a whole number of rows (n x 104 + (n-1) x 16)"
            }
            out
        }
    }
}
