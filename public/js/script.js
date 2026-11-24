const bar = document.getElementById('bar');
const close = document.getElementById('close');
const nav = document.getElementById('navbar');


if(bar&&nav){
 const mobileViewport=window.matchMedia('(max-width: 1024px)');
 function setMenu(open,restore=false){nav.classList.toggle('active',open);bar.setAttribute('aria-expanded',String(open));if(open)close?.focus();else if(restore)bar.focus()}
 bar.setAttribute('aria-controls','navbar');bar.setAttribute('aria-expanded','false');
 bar.addEventListener('click',()=>setMenu(!nav.classList.contains('active')));
 close?.setAttribute('aria-label','Close navigation');close?.addEventListener('click',e=>{e.preventDefault();setMenu(false,true)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('active'))setMenu(false,true)});
 document.addEventListener('click',e=>{if(nav.classList.contains('active')&&!nav.contains(e.target)&&!bar.contains(e.target))setMenu(false)});
 nav.querySelectorAll('a:not(#close)').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
 mobileViewport.addEventListener('change',()=>setMenu(false));
}


let slideIndex = 0;
const slides = document.querySelectorAll('.slide');

function showSlides() {
  if (!slides.length) return;
  slides.forEach((slide, i) => {
    slide.classList.remove('active');
  });
  slideIndex++;
  if (slideIndex > slides.length) slideIndex = 1;
  slides[slideIndex - 1].classList.add('active');
  setTimeout(showSlides, 4000); // Change every 4 seconds
}

document.addEventListener("DOMContentLoaded", showSlides);





//FAQ SECTION
 const questions = document.querySelectorAll(".faq-question");
    questions.forEach(q => {
      q.addEventListener("click", () => {
        q.classList.toggle("active");
        const answer = q.nextElementSibling;
        answer.style.display = answer.style.display === "block" ? "none" : "block";
      });
    });










     function calculateReturn() {
    const amount = parseFloat(document.getElementById('amount').value);
    const rate = parseFloat(document.getElementById('plan').value);
    const months = parseInt(document.getElementById('months').value);

    if (isNaN(amount) || isNaN(rate) || isNaN(months)) {
      document.getElementById('result').innerHTML = "Please enter valid inputs.";
      return;
    }

    const totalReturn = amount * ((rate / 100) * months);
    const finalAmount = amount + totalReturn;

    document.getElementById('result').innerHTML = `
      <p><strong>Total Return:</strong> ₦${totalReturn.toLocaleString()}</p>
      <p><strong>Final Value:</strong> ₦${finalAmount.toLocaleString()}</p>
    `;
  }



  


   document.getElementById("jobForm")?.addEventListener("submit", function(e) {
      e.preventDefault();

      let isValid = true;
      const name = document.getElementById("name");
      const email = document.getElementById("email");
      const phone = document.getElementById("phone");
      const position = document.getElementById("position");
      const resume = document.getElementById("resume");
      const message = document.getElementById("formMessage");

      // Clear old messages
      document.querySelectorAll('.error').forEach(e => e.textContent = '');
      message.textContent = '';

      // Name validation
      if (name.value.trim() === "") {
        document.getElementById("nameError").textContent = "Full name is required";
        isValid = false;
      }

      // Email validation
      if (email.value.trim() === "" || !email.value.includes("@")) {
        document.getElementById("emailError").textContent = "Valid email is required";
        isValid = false;
      }

      // Phone validation
      if (phone.value.trim() === "") {
        document.getElementById("phoneError").textContent = "Phone number is required";
        isValid = false;
      }

      // Position validation
      if (position.value === "") {
        document.getElementById("positionError").textContent = "Please select a position";
        isValid = false;
      }

      // Resume validation
      if (!resume.files.length) {
        document.getElementById("resumeError").textContent = "Please upload your resume";
        isValid = false;
      }

      // If all valid
      if (isValid) {
        message.textContent = "Application submitted successfully!";
        document.getElementById("jobForm").reset();
      }
    });




















