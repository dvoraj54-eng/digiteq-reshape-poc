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
        7 -> Tip(R.string.tip_7_title, R.string.tip_7_subtitle, R.string.tip_7_body)
        8 -> Tip(R.string.tip_8_title, R.string.tip_8_subtitle, R.string.tip_8_body)
        9 -> Tip(R.string.tip_9_title, R.string.tip_9_subtitle, R.string.tip_9_body)
        10 -> Tip(R.string.tip_10_title, R.string.tip_10_subtitle, R.string.tip_10_body)
        else -> Tip(R.string.tip_11_title, R.string.tip_11_subtitle, R.string.tip_11_body)
    }

    val tips: List<Tip> = (1..11).map(::tip)
}
