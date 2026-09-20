package cz.digiteq.tips.ui

import android.view.View
import android.view.ViewGroup

/**
 * Design rule R7: side-by-side panes end on one line.
 *
 * A list pane can only show whole rows. This sets the height of every pane in [panes]
 * to the largest whole number of rows that fits into the free height of this container
 * (n rows + (n - 1) gaps), so the list and the card next to it end at the last visible row.
 * The rest stays free at the bottom. Re-runs when the container's height changes.
 *
 * It only looks at the container's height, never at the display shape, so the same
 * call works on the wide and on the portrait layout.
 */
fun ViewGroup.alignPanesToRows(
    panes: List<View>,
    rowCount: Int,
    rowHeightPx: Int,
    rowGapPx: Int,
) {
    fun apply() {
        val available = height - paddingTop - paddingBottom
        if (available <= 0) return
        val rows = ((available + rowGapPx) / (rowHeightPx + rowGapPx)).coerceIn(1, rowCount)
        val target = rows * (rowHeightPx + rowGapPx) - rowGapPx
        for (pane in panes) {
            if (pane.layoutParams.height != target) {
                pane.layoutParams.height = target
                pane.requestLayout()
            }
        }
    }

    addOnLayoutChangeListener { _, _, top, _, bottom, _, oldTop, _, oldBottom ->
        if (bottom - top != oldBottom - oldTop) apply()
    }
    if (isLaidOut) apply()
}
