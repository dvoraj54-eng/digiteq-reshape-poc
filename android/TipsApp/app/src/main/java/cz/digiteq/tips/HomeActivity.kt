package cz.digiteq.tips

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import cz.digiteq.tips.databinding.ActivityHomeBinding
import cz.digiteq.tips.util.padForSystemBars

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.root.padForSystemBars()

        // Every category card opens the category screen (only "Driving" has content in this POC).
        // The cards come from <include> files, so ViewBinding doesn't expose them: look them up by ID.
        listOf(
            R.id.home_category_card_driving,
            R.id.home_category_card_comfort,
            R.id.home_category_card_efficiency,
            R.id.home_category_card_safety,
        ).forEach { id ->
            findViewById<View>(id).setOnClickListener {
                startActivity(Intent(this, CategoryActivity::class.java))
            }
        }
        binding.homeFeaturedTipOpenButton.setOnClickListener {
            startActivity(Intent(this, TipDetailActivity::class.java))
        }
    }
}
