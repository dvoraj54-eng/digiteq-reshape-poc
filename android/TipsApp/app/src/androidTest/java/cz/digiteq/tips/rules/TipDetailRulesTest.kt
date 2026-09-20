package cz.digiteq.tips.rules

import cz.digiteq.tips.R
import cz.digiteq.tips.TipDetailActivity
import org.junit.Test

class TipDetailRulesTest : ScreenRulesTest(
    activityClass = TipDetailActivity::class.java,
    rootId = R.id.tip_root,
    contentId = "tip_content",
    wideExport = "S3_TipDetail_1840x960.flat.json",
    portraitExport = "S3_TipDetail_1400x1400.flat.json",
    p0 = listOf(
        "tip_title", "tip_back_button", "tip_body", "tip_steps", "tip_prev_button", "tip_next_button",
    ),
    groupedControls = setOf("tip_distance_segmented"),
) {
    /** R5: the settings column is at least 800 dp wide; single-column content is at most 1200 dp. */
    @Test
    fun bodyColumnWidthIsWithinLimits() = onScreen { c ->
        val w = c.dp(c.view("tip_body")!!.width)
        val out = mutableListOf<String>()
        if (w < 799.5f) out += "tip_body is ${w.toInt()} dp wide, minimum 800"
        if (isPortrait() && w > 1200.5f) out += "tip_body is ${w.toInt()} dp wide, single column maximum 1200"
        out
    }

    /** Portrait (R2 + R5): image and body are stacked and centred; the image takes at most 40 % of the content height. */
    @Test
    fun portraitColumnIsStackedAndCentred() {
        if (!isPortrait()) return
        onScreen { c ->
            val out = mutableListOf<String>()
            val image = c.view("tip_image")!!; val body = c.view("tip_body")!!
            val content = c.view("tip_content")!!
            val centre = (c.area.left + c.area.right) / 2f
            for (v in listOf(image, body)) {
                val w = c.window(v)
                if (kotlin.math.abs((w.left + w.right) / 2f - centre) > 1) out += "'${c.name(v)}' is not centred"
                if (c.dp(v.width) > 1200.5f) out += "'${c.name(v)}' is wider than 1200 dp"
            }
            if (c.window(image).bottom > c.window(body).top) out += "tip_image and tip_body are not stacked (image ends below the body's top)"
            if (image.height > 0.4f * content.height) out += "tip_image is ${c.dp(image.height).toInt()} dp high: more than 40 % of the content height"
            out
        }
    }
}
