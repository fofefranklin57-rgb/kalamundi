# EPUBCheck

Place `epubcheck.jar` here to activate strict EPUB validation:

```powershell
node scripts/validate_epub.mjs path\to\book.epub
```

Alternative:

```powershell
$env:EPUBCHECK_JAR="C:\path\to\epubcheck.jar"
node scripts/validate_epub.mjs path\to\book.epub
```

The jar is not committed because it is a third-party binary.
