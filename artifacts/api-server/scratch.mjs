import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: "rzp_test_SmuD7tzf3QAeSL",
  key_secret: "vqItBsXRzRhKnObaZk8O3x67",
});

async function run() {
  try {
    const options = {
      plan_id: "plan_SmwTtRbVvWPIq6",
      total_count: 10,
      customer_notify: 1,
      notes: {
        userId: "test_user_id",
        planType: "yearly"
      }
    };
    const subscription = await razorpay.subscriptions.create(options);
    console.log("Success:", subscription.id);
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
