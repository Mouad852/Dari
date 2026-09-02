package ma.dari.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Dari — colocation marketplace for Morocco.
 *
 * <p>A single Spring Boot deployable. Packages are organized by feature, not by
 * layer: everything about listings lives in {@code listing}, everything about
 * moderation in {@code moderation}. A {@code controllers} package holding twelve
 * unrelated controllers ages badly; a feature package does not.
 *
 * <p>The module boundaries here are the seams a future extraction would follow.
 * Nothing is extracted today, and nothing should be until traffic argues for it.
 */
@SpringBootApplication
@EnableScheduling
public class DariApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(DariApiApplication.class, args);
    }
}
