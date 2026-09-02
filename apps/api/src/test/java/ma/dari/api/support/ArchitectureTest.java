package ma.dari.api.support;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Rules that are easy to state, easy to violate accidentally, and expensive to
 * discover by review three months later.
 *
 * <p>Phase 02 adds the one that matters most: no query outside the listing
 * package may read the {@code listings} table directly, so the
 * {@code status = PUBLISHED AND availability_state = AVAILABLE} invariant cannot
 * be forgotten in a new feature.
 */
@AnalyzeClasses(
        packages = "ma.dari.api",
        importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    /** Entities are never serialized to clients; every response is an explicit DTO. */
    @ArchTest
    static final ArchRule controllersDoNotReturnEntities = noClasses()
            .that().resideInAPackage("..user..")
            .and().haveSimpleNameEndingWith("Controller")
            .should().accessClassesThat().haveSimpleName("UserRepository")
            .because("controllers go through services; repositories are not a controller concern");

    /** Feature packages stay independent of each other's internals. */
    @ArchTest
    static final ArchRule commonDependsOnNoFeature = noClasses()
            .that().resideInAPackage("..common.pagination..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..listing..", "..messaging..", "..moderation..")
            .because("shared primitives must not know about features that use them");
}
