package cz.digiteq.tips.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import android.widget.ScrollView
import cz.digiteq.tips.R

/**
 * Always-visible scrollbar from the design: the track is the view background,
 * the thumb has a fixed height and follows the scroll position of a ScrollView.
 * (The built-in scrollbar fades out and its thumb size can't be set.)
 */
class ListScrollbar @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = context.getColor(R.color.white_90) }
    private val thumbHeight = resources.getDimension(R.dimen.scrollbar_thumb_height)
    private val thumbRect = RectF()
    private var scrollFraction = 0f

    fun attachTo(scrollView: ScrollView) {
        scrollView.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            val content = (view as ScrollView).getChildAt(0)
            val range = (content?.height ?: 0) - view.height
            scrollFraction = if (range > 0) (scrollY.toFloat() / range).coerceIn(0f, 1f) else 0f
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        val h = minOf(thumbHeight, height.toFloat())
        val top = scrollFraction * (height - h)
        thumbRect.set(0f, top, width.toFloat(), top + h)
        canvas.drawRoundRect(thumbRect, width / 2f, width / 2f, thumbPaint)
    }
}
