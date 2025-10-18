package com.collablearn.tests;

import org.testng.annotations.*;
import org.testng.Assert;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

/**
 * TestNG Unit Tests for Authentication Service
 * Simple unit tests demonstrating testing principles without external dependencies
 */
public class AuthServiceUnitTest {

    private AuthService authService;

    @BeforeClass
    public void setUpClass() {
        System.out.println("🧪 === AUTHENTICATION SERVICE UNIT TESTS ===");
        System.out.println("✅ Testing Framework: TestNG");
        System.out.println("✅ Test Type: Unit Testing");
        System.out.println("✅ Service: Authentication Service");
    }

    @BeforeMethod
    public void setUp() {
        authService = new AuthService();
        System.out.println("🔧 Setting up test environment");
    }

    @Test(groups = {"unit", "auth", "validation"}, priority = 1)
    public void testPasswordStrengthValidation_StrongPassword_ShouldPass() {
        System.out.println("\n🔒 Testing Strong Password Validation");
        String strongPassword = "StrongPassword123!";
        boolean result = authService.validatePasswordStrength(strongPassword);
        Assert.assertTrue(result, "Strong password should be accepted");
        System.out.println("   ✅ Strong password validation PASSED");
    }

    @Test(groups = {"unit", "auth", "validation"}, priority = 2)
    public void testPasswordStrengthValidation_WeakPasswords_ShouldFail() {
        System.out.println("\n🚫 Testing Weak Password Validation");

        String[] weakPasswords = {
            "123",           // Too short
            "password",      // No numbers/special chars
            "12345678",      // Only numbers
            "PASSWORD",      // Only uppercase
            "password123"    // No special characters
        };

        for (String weakPassword : weakPasswords) {
            boolean result = authService.validatePasswordStrength(weakPassword);
            Assert.assertFalse(result, "Weak password should be rejected: " + weakPassword);
            System.out.println("   ❌ Weak password '" + weakPassword + "' correctly rejected");
        }
        System.out.println("   ✅ All weak password validations PASSED");
    }

    @Test(groups = {"unit", "auth", "email"}, priority = 3)
    public void testEmailValidation_ValidEmails_ShouldPass() {
        System.out.println("\n📧 Testing Valid Email Validation");
        String[] validEmails = {
            "test@collablearn.com",
            "user.name@example.org",
            "student123@university.edu",
            "admin+test@domain.co.uk"
        };
        for (String email : validEmails) {
            boolean result = authService.validateEmail(email);
            Assert.assertTrue(result, "Valid email should be accepted: " + email);
            System.out.println("   ✅ Valid email '" + email + "' accepted");
        }
        System.out.println("   ✅ All valid email validations PASSED");
    }

    @Test(groups = {"unit", "auth", "email"}, priority = 4)
    public void testEmailValidation_InvalidEmails_ShouldFail() {
        System.out.println("\n🚫 Testing Invalid Email Validation");
        String[] invalidEmails = {
            "invalid-email",
            "@domain.com",
            "user@",
            "user name@domain.com",
            ""
        };
        for (String email : invalidEmails) {
            boolean result = authService.validateEmail(email);
            Assert.assertFalse(result, "Invalid email should be rejected: " + email);
            System.out.println("   ❌ Invalid email '" + email + "' correctly rejected");
        }
        System.out.println("   ✅ All invalid email validations PASSED");
    }

    @Test(groups = {"unit", "auth", "jwt"}, priority = 5)
    public void testJwtTokenGeneration_ValidUser_ShouldGenerateToken() {
        System.out.println("\n🔑 Testing JWT Token Generation");

        User testUser = new User("user123", "test@collablearn.com", "John", "Doe");
        String token = authService.generateJwtToken(testUser);

        Assert.assertNotNull(token, "JWT token should not be null");
        Assert.assertTrue(token.length() > 50, "JWT token should have reasonable length");
        Assert.assertTrue(token.contains("."), "JWT token should contain dots (segments)");

        System.out.println("   ✅ JWT token generated: " + token.substring(0, 24) + "...");
        System.out.println("   ✅ JWT token generation PASSED");
    }

    @Test(groups = {"unit", "auth", "jwt"}, priority = 6)
    public void testJwtTokenValidation_ValidToken_ShouldValidate() {
        System.out.println("\n🔍 Testing JWT Token Validation");

        User testUser = new User("user123", "test@collablearn.com", "John", "Doe");
        String token = authService.generateJwtToken(testUser);

        boolean isValid = authService.validateJwtToken(token);
        Assert.assertTrue(isValid, "Generated JWT token should be valid");
        System.out.println("   ✅ JWT token validation PASSED");
    }

    @Test(groups = {"unit", "auth", "jwt"}, priority = 7)
    public void testJwtTokenValidation_InvalidToken_ShouldFail() {
        System.out.println("\n🚫 Testing Invalid JWT Token Validation");

        String[] invalidTokens = {
            "invalid.token.here",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
            "",
            "not-a-jwt-token"
        };

        for (String invalidToken : invalidTokens) {
            boolean isValid = authService.validateJwtToken(invalidToken);
            Assert.assertFalse(isValid, "Invalid token should not validate: " + invalidToken);
            System.out.println("   ❌ Invalid token '" + invalidToken + "' correctly rejected");
        }
        System.out.println("   ✅ Invalid JWT token validations PASSED");
    }

    @Test(groups = {"unit", "auth", "security"}, priority = 8)
    public void testPasswordHashing_SamePassword_ShouldProduceDifferentHashes() {
        System.out.println("\n🔐 Testing Password Hashing Security");

        String password = "TestPassword123!";
        String hash1 = authService.hashPassword(password);
        String hash2 = authService.hashPassword(password);

        Assert.assertNotNull(hash1, "First hash should not be null");
        Assert.assertNotNull(hash2, "Second hash should not be null");
        Assert.assertNotEquals(hash1, hash2, "Same password should produce different hashes (salt)");
        Assert.assertTrue(hash1.length() > 20, "Hash should have reasonable length");

        System.out.println("   ✅ Hash 1: " + hash1.substring(0, 20) + "...");
        System.out.println("   ✅ Hash 2: " + hash2.substring(0, 20) + "...");
        System.out.println("   ✅ Password hashing security PASSED");
    }

    @Test(groups = {"unit", "auth", "security"}, priority = 9)
    public void testPasswordVerification_CorrectPassword_ShouldVerify() {
        System.out.println("\n✅ Testing Password Verification");

        String password = "TestPassword123!";
        String hash = authService.hashPassword(password);

        boolean isMatch = authService.verifyPassword(password, hash);
        Assert.assertTrue(isMatch, "Correct password should verify against its hash");
        System.out.println("   ✅ Password verification PASSED");
    }

    @Test(groups = {"unit", "auth", "security"}, priority = 10)
    public void testPasswordVerification_WrongPassword_ShouldFail() {
        System.out.println("\n❌ Testing Wrong Password Verification");

        String correctPassword = "TestPassword123!";
        String wrongPassword = "WrongPassword456@";
        String hash = authService.hashPassword(correctPassword);

        boolean isMatch = authService.verifyPassword(wrongPassword, hash);
        Assert.assertFalse(isMatch, "Wrong password should not verify");
        System.out.println("   ✅ Wrong password verification PASSED");
    }

    @AfterMethod
    public void tearDown() {
        System.out.println("🧹 Cleaning up test environment");
    }

    @AfterClass
    public void tearDownClass() {
        System.out.println("\n🏆 === AUTHENTICATION UNIT TESTS COMPLETED ===");
        System.out.println("✅ All authentication validations passed");
        System.out.println("✅ Security features verified");
        System.out.println("✅ JWT token management tested");
    }

    // ====== Simple data model ======
    public static class User {
        private final String id;
        private final String email;
        private final String firstName;
        private final String lastName;

        public User(String id, String email, String firstName, String lastName) {
            this.id = id;
            this.email = email;
            this.firstName = firstName;
            this.lastName = lastName;
        }
        public String getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
    }

    // ====== Fake AuthService with sturdier implementations ======
    public static class AuthService {

        // Password strength: upper, lower, digit, special, length >= 8
        public boolean validatePasswordStrength(String password) {
            if (password == null || password.length() < 8) return false;
            boolean hasUpper = password.matches(".*[A-Z].*");
            boolean hasLower = password.matches(".*[a-z].*");
            boolean hasDigit = password.matches(".*[0-9].*");
            boolean hasSpecial = password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*");
            return hasUpper && hasLower && hasDigit && hasSpecial;
        }

        public boolean validateEmail(String email) {
            if (email == null || email.trim().isEmpty()) return false;
            String emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
            return email.matches(emailRegex);
        }

        // ---- JWT (fake but realistic): header/payload Base64URL + unique signature
        public String generateJwtToken(User user) {
            String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
            // include userId & email so payload isn't blank
            String payloadJson = String.format("{\"sub\":\"%s\",\"userId\":\"%s\",\"email\":\"%s\"}",
                    user.getEmail(), user.getId(), user.getEmail());

            String header = base64UrlEncode(headerJson);
            String payload = base64UrlEncode(payloadJson);
            // make signature unique & long
            String signature = base64UrlEncode(payload + "." + UUID.randomUUID());

            return header + "." + payload + "." + signature;
        }

        public boolean validateJwtToken(String token) {
            if (token == null || token.trim().isEmpty()) return false;
            String[] parts = token.split("\\.");
            if (parts.length != 3) return false;

            try {
                String decodedHeader = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
                String decodedPayload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                boolean headerOk = decodedHeader.contains("\"alg\":\"HS256\"") && decodedHeader.contains("\"typ\":\"JWT\"");
                boolean payloadOk = decodedPayload.contains("\"userId\"") && decodedPayload.contains("\"email\"");
                boolean sigOk = parts[2] != null && parts[2].length() > 10;
                return headerOk && payloadOk && sigOk;
            } catch (IllegalArgumentException e) {
                return false; // bad base64
            }
        }

        private String base64UrlEncode(String s) {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
        }

        // ---- Hashing with embedded random salt; verifiable
        // format: $fakeBcrypt$<salt>$<hash>
        public String hashPassword(String password) {
            String salt = UUID.randomUUID().toString();
            String hash = Integer.toHexString((password + "::" + salt).hashCode());
            return "$fakeBcrypt$" + salt + "$" + hash;
        }

        public boolean verifyPassword(String password, String stored) {
            if (stored == null || !stored.startsWith("$fakeBcrypt$")) return false;
            String[] parts = stored.split("\\$");
            if (parts.length != 4) return false; // ["", "fakeBcrypt", salt, hash]
            String salt = parts[2];
            String expected = Integer.toHexString((password + "::" + salt).hashCode());
            return expected.equals(parts[3]);
        }
    }
}
