package cz.digiteq.tips.data

import androidx.annotation.StringRes
import cz.digiteq.tips.R

data class Tip(
    @param:StringRes val title: Int,
    @param:StringRes val subtitle: Int,
    @param:StringRes val body: Int,
)

/** Static, invented content. The list order = the row order on S2. */
object TipsRepository {

    private fun tip(n: Int) = when (n) {
        1 -> Tip(R.string.tip_1_title, R.string.tip_1_subtitle, R.string.tip_1_body)
        2 -> Tip(R.string.tip_2_title, R.string.tip_2_subtitle, R.string.tip_2_body)
        3 -> Tip(R.string.tip_3_title, R.string.tip_3_subtitle, R.string.tip_3_body)
        4 -> Tip(R.string.tip_4_title, R.string.tip_4_subtitle, R.string.tip_4_body)
        5 -> Tip(R.string.tip_5_title, R.string.tip_5_subtitle, R.string.tip_5_body)
        6 -> Tip(R.string.tip_6_title, R.string.tip_6_subtitle, R.string.tip_6_body)
        else -> Tip(R.string.tip_7_title, R.string.tip_7_subtitle, R.string.tip_7_body)
    }

    // Rows 8-11 repeat tips 1-4, like the Figma placeholder rows.
    val tips: List<Tip> = listOf(1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4).map(::tip)
}
